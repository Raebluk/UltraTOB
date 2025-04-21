import { Category } from '@discordx/utilities'
import { LoggerRequestFields, PlatformLayer } from '@tsed/common'
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	CommandInteraction,
	EmbedBuilder,
	MessageActionRowComponentBuilder,
} from 'discord.js'
import { ButtonComponent } from 'discordx'

import { Discord, Injectable, Slash } from '@/decorators'
import {
	DailyCounter,
	DailyCounterRepository,
	Guild,
	GuildConfigItem,
	GuildConfigItemRepository,
	GuildRepository,
	Player,
	PlayerRepository,
	User,
	UserRepository,
} from '@/entities'
import { Guard } from '@/guards'
import { Database, Logger } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

// Experience and level calculation constants (matching Python exactly)
const EXP_FACTOR = 1.30
const LVL_UPPER_BOUND = 2000

// Pre-calculate experience tables using the SAME algorithm as Python
const EXP_PER_LVL: Record<number, number> = { 1: 10 }
const CACHE_EXP_PER_LVL: Record<number, number> = { 1: 10 }
const EXP_TOTAL_LVL: Record<number, number> = { 1: 10 }

// Initialize experience tables using Python's exact algorithm
for (let i = 2; i <= LVL_UPPER_BOUND; i++) {
	// Python: round next_lvl_exp to the nearest 5 multiply integer
	// CRITICAL: Use CACHE_EXP_PER_LVL (floating point) for calculations, not EXP_PER_LVL (rounded)
	CACHE_EXP_PER_LVL[i] = CACHE_EXP_PER_LVL[i - 1] * EXP_FACTOR
	const nextLvlExp = Math.round(CACHE_EXP_PER_LVL[i - 1] * EXP_FACTOR / 5) * 5
	EXP_PER_LVL[i] = nextLvlExp < 3000 ? nextLvlExp : 3000
	EXP_TOTAL_LVL[i] = EXP_TOTAL_LVL[i - 1] + EXP_PER_LVL[i]
}

// Rank names mapping (converted from Python)
const RANK_NAMES: Record<string, string> = {
	'0-0': '不堪一击（需要完成初始任务）',
	'1-4': '初学乍练',
	'5-9': '略有所成',
	'10-14': '小试锋芒',
	'15-19': '渐入佳境',
	'20-24': '心领神会',
	'25-29': '融会贯通',
	'30-34': '出类拔萃',
	'35-39': '炉火纯青',
	'40-44': '登堂入室',
	'45-49': '名震一方',
	'50-54': '超凡脱俗',
	'55-59': '登峰造极',
	'60-64': '傲视群雄',
	'65-69': '独步天下',
	'70-74': '威震四海',
	'75-79': '举世无双',
	'80-84': '破碎虚空',
	'85-89': '天人合一',
	'90-94': '超凡入圣',
	'95-99': '返璞归真',
	'100-104': '大道至简',
	'105-109': '万象归一',
	'110-114': '乾坤无极',
	'115-119': '星辰变',
	'120-124': '虚空行者',
	'125-129': '混沌初开',
	'130-134': '天道轮回',
	'135-139': '万法归宗',
	'140-144': '宇宙洪荒',
	'145-149': '永恒之境',
	'150-154': '创世之神',
	'155-159': '时空主宰',
	'160-164': '维度掌控者',
	'165-169': '命运编织者',
	'170-174': '万物起源',
	'175-179': '无限之巅',
	'180-184': '超脱轮回',
	'185-189': '终极真理',
	'190-194': '永恒不朽',
	'195-199': '无尽传说',
	'200-2000': '你他娘的肯定是三体人吧',
}

/**
 * Calculate level from total experience points
 */
function calculateLevelFromExp(totalExp: number): number {
	if (totalExp <= 0) return 0

	for (let level = 1; level <= LVL_UPPER_BOUND; level++) {
		if (totalExp <= EXP_TOTAL_LVL[level]) {
			return level
		}
	}

	return LVL_UPPER_BOUND
}

/**
 * Get rank name from level
 */
function getRankNameFromLevel(level: number): string {
	if (level === 0) return RANK_NAMES['0-0']

	// Find the appropriate range for the level
	for (const [range, rankName] of Object.entries(RANK_NAMES)) {
		if (range === '0-0') continue

		const [min, max] = range.split('-').map(Number)
		if (level >= min && level <= max) {
			return rankName
		}
	}

	// Fallback for very high levels
	return RANK_NAMES['200-2000']
}

@Discord()
@Injectable()
@Category('General')
export default class LeaderboardCommand {

	private userRepo: UserRepository
	private playerRepo: PlayerRepository
	private guildRepo: GuildRepository
	private counterRepo: DailyCounterRepository
	private configRepo: GuildConfigItemRepository

	// Cache for performance improvement
	private leaderboardCache = new Map<string, { data: Player[], timestamp: number }>()
	private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.configRepo = this.db.get(GuildConfigItem)
		this.userRepo = this.db.get(User)
		this.playerRepo = this.db.get(Player)
		this.guildRepo = this.db.get(Guild)
		this.counterRepo = this.db.get(DailyCounter)
	}

	/**
	 * Get cached players data or fetch from database
	 */
	private async getCachedPlayers(guildId: string): Promise<Player[]> {
		const cached = this.leaderboardCache.get(guildId)
		const now = Date.now()

		if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
			return cached.data
		}

		try {
			const guildEntity = await this.guildRepo.findOneOrFail({ id: guildId })
			const players = await this.playerRepo.find(
				{ guild: guildEntity, exp: { $gte: 1 } },
				{ orderBy: { exp: 'DESC' } }
			)

			this.leaderboardCache.set(guildId, { data: players, timestamp: now })

			return players
		} catch (error) {
			this.logger.log(`Failed to fetch players for guild ${guildId}: ${error}`, 'error')

			// Return cached data if available, even if expired
			return cached?.data || []
		}
	}

	@Slash({
		name: 'leaderboard',
		description: '查看社区排行榜',
	})
	@Guard()
	async leaderboard(interaction: CommandInteraction) {
		await interaction.deferReply()

		await this.playerRepo.getEntityManager().flush()
		await this.counterRepo.getEntityManager().flush()

		const guild = resolveGuild(interaction)
		if (!guild) {
			return interaction.followUp({
				content: '❌ 无法获取服务器信息，请稍后再试。',
				ephemeral: true,
			})
		}

		try {
			const guildEntity = await this.guildRepo.findOneOrFail({ id: guild.id })

			const userCommandAllowedConfig = await this.configRepo.get('userCommandAllowed', guildEntity)
			const userCommandAllowed = userCommandAllowedConfig !== null
				? (JSON.parse(userCommandAllowedConfig.value) as string[])
				: []

			if (!userCommandAllowed.includes(interaction.channelId)) {
				const allowedChannels = userCommandAllowed.map(channelId => `<#${channelId}>`).join(', ')

				return interaction.followUp({
					content: `由于 TOB 的放射性危害，有关部门已经规定:\nTOB 的 \`/leaderboard\` 指令需要前往以下频道执行: ${allowedChannels}！`,
					ephemeral: true,
				})
			}

			const { embed, buttons } = await this.buildLeaderboardEmbed(interaction, 1)

			const replayStr = '绝密档案... 请稍等...'

			return interaction.followUp({
				content: replayStr,
				embeds: [embed],
				components: [buttons],
			})
		} catch (error) {
			this.logger.log(`Failed to load leaderboard for guild ${guild.id}: ${error}`, 'error')

			return interaction.followUp({
				content: '❌ 排行榜加载失败，请稍后再试。',
				ephemeral: true,
			})
		}
	}

	private async buildLeaderboardEmbed(
		interaction: CommandInteraction | ButtonInteraction,
		currentPageIdx: number = 1,
		originalUserId?: string
	): Promise<{ embed: EmbedBuilder, buttons: ActionRowBuilder<MessageActionRowComponentBuilder> }> {
		try {
			const guild = resolveGuild(interaction)
			if (!guild) {
				throw new Error('Guild not found')
			}

			// Determine the original user ID (use provided or current user)
			const userId = originalUserId || interaction.user.id

			// Get cached players data
			const allPlayers = await this.getCachedPlayers(guild.id)

			// Pagination variables
			const playersPerPage = 10
			const totalPages = Math.ceil(allPlayers.length / playersPerPage)

			// Ensure page index is within bounds
			const safePageIdx = Math.max(1, Math.min(currentPageIdx, totalPages))

			// Get players for the current page
			const startIdx = (safePageIdx - 1) * playersPerPage
			const endIdx = startIdx + playersPerPage
			const pagePlayers = allPlayers.slice(startIdx, endIdx)

			// Build leaderboard fields
			const leaderboardFields = pagePlayers.map((player, idx) => {
				const rank = startIdx + idx + 1
				const level = calculateLevelFromExp(player.exp)
				const rankName = getRankNameFromLevel(level)

				return {
					name: `🎮${rank}`,
					value: `<@${player.user.id}>\n⭐️ 等级: \`${level}\` ⭐️ \`${rankName}\` ⭐️`,
					inline: false,
				}
			})

			const userRank = allPlayers.findIndex(player => player.user.id === interaction.user.id) + 1

			const embed = new EmbedBuilder()
				.setTitle(`⭐丨服务器活跃度排行榜丨⭐`)
				.addFields(leaderboardFields.length > 0
					? leaderboardFields
					: [
							{ name: '暂无玩家', value: '没有可显示的玩家。', inline: false },
						])
				.setColor('#7A76EB')
				.setTimestamp()
				.setFooter({
					text: `🤖 你的全服排名是第${userRank}名 | 第 ${safePageIdx} / ${totalPages} 页`,
				})

			const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>()

			if (safePageIdx > 1) {
				buttons.addComponents(
					new ButtonBuilder()
						.setCustomId(`prev-lb-page-${safePageIdx}-${userId}`)
						.setLabel('⬅️')
						.setStyle(ButtonStyle.Primary)
				)
			}

			// Add refresh button
			buttons.addComponents(
				new ButtonBuilder()
					.setCustomId(`refresh-lb-page-${safePageIdx}-${userId}`)
					.setLabel('🔄')
					.setStyle(ButtonStyle.Secondary)
			)

			if (safePageIdx < totalPages) {
				buttons.addComponents(
					new ButtonBuilder()
						.setCustomId(`next-lb-page-${safePageIdx}-${userId}`)
						.setLabel('➡️')
						.setStyle(ButtonStyle.Primary)
				)
			}

			return {
				embed,
				buttons,
			}
		} catch (error) {
			this.logger.log(`Failed to build leaderboard embed: ${error}`, 'error')

			const errorEmbed = new EmbedBuilder()
				.setTitle('❌ 排行榜加载失败')
				.setDescription('无法加载排行榜数据，请稍后再试。')
				.setColor('#FF0000')

			return {
				embed: errorEmbed,
				buttons: new ActionRowBuilder<MessageActionRowComponentBuilder>(),
			}
		}
	}

	@ButtonComponent({ id: /^(next|prev|refresh)-lb-page-(\d+)-(\d+)$/ })
	async handleLeaderboardButton(interaction: ButtonInteraction) {
		try {
			// Parse action, current page, and original user ID from custom ID
			const match = interaction.customId.match(/^(next|prev|refresh)-lb-page-(\d+)-(\d+)$/)
			if (!match) {
				throw new Error('Invalid button custom ID')
			}

			const [, action, currentPageStr, originalUserId] = match
			const currentPage = Number.parseInt(currentPageStr)

			// Check if the current user is the one who originally executed the command
			if (interaction.user.id !== originalUserId) {
				return interaction.reply({
					content: '❌ 只有执行命令的用户才能操作排行榜按钮。',
					ephemeral: true,
				})
			}

			await interaction.deferUpdate()

			let newPageIdx: number
			switch (action) {
				case 'next':
					newPageIdx = currentPage + 1
					break

				case 'prev':
					newPageIdx = currentPage - 1
					break

				case 'refresh': {
					// Clear cache for refresh
					const guild = resolveGuild(interaction)
					if (guild) {
						this.leaderboardCache.delete(guild.id)
					}
					newPageIdx = currentPage
					break
				}

				default:
					newPageIdx = currentPage
			}

			const { embed, buttons } = await this.buildLeaderboardEmbed(interaction, newPageIdx, originalUserId)

			await interaction.editReply({
				embeds: [embed],
				components: [buttons],
			})
		} catch (error) {
			this.logger.log(`Failed to handle leaderboard button: ${error}`, 'error')
			await interaction.editReply({
				content: '❌ 操作失败，请重新尝试 `/leaderboard` 命令。',
				embeds: [],
				components: [],
			})
		}
	}

}
