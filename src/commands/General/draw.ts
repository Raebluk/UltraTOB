import { Category } from '@discordx/utilities'
import { CommandInteraction, EmbedBuilder, Guild as DiscordGuild } from 'discord.js'

import { Discord, Injectable, Slash } from '@/decorators'
import {
	DrawHistory,
	DrawHistoryRepository,
	DrawReward,
	DrawRewardRepository,
	Guild,
	GuildConfigItem,
	GuildConfigItemRepository,
	GuildRepository,
	Player,
	PlayerRepository,
	User,
	UserRepository,
	ValueChangeLog,
	ValueChangeLogRepository,
} from '@/entities'
import { Guard } from '@/guards'
import { Database, Logger } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

@Discord()
@Injectable()
@Category('General')
export default class DrawCommand {

	// Test mode is now configured via guild config: botTestMode (defaults to false)

	private userRepo: UserRepository
	private playerRepo: PlayerRepository
	private guildRepo: GuildRepository
	private drawRewardRepo: DrawRewardRepository
	private drawHistoryRepo: DrawHistoryRepository
	private valueChangeLogRepo: ValueChangeLogRepository
	private configRepo: GuildConfigItemRepository

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.userRepo = this.db.get(User)
		this.playerRepo = this.db.get(Player)
		this.guildRepo = this.db.get(Guild)
		this.drawRewardRepo = this.db.get(DrawReward)
		this.drawHistoryRepo = this.db.get(DrawHistory)
		this.valueChangeLogRepo = this.db.get(ValueChangeLog)
		this.configRepo = this.db.get(GuildConfigItem)
	}

	@Slash({
		name: 'draw',
		description: '抽取每日奖励',
	})
	@Guard()
	async draw(interaction: CommandInteraction) {
		await interaction.deferReply()

		const guild = resolveGuild(interaction)
		const user = interaction.user

		if (!guild || !user) {
			return interaction.followUp({
				content: '❌ 无法获取服务器或用户信息，请稍后再试。',
				ephemeral: true,
			})
		}

		try {
			const guildEntity = await this.guildRepo.findOneOrFail({ id: guild.id })
			const userEntity = await this.userRepo.findOneOrFail({ id: user.id })

			// Check if command is used in allowed channel
			const drawCommandAllowedConfig = await this.configRepo.get('drawCommandAllowed', guildEntity)
			const drawCommandAllowed = drawCommandAllowedConfig !== null
				? (JSON.parse(drawCommandAllowedConfig.value) as string[])
				: []

			if (drawCommandAllowed.length > 0 && !drawCommandAllowed.includes(interaction.channelId)) {
				const allowedChannels = drawCommandAllowed.map(channelId => `<#${channelId}>`).join(', ')

				return interaction.followUp({
					content: `🎲 抽奖功能仅在指定频道可用！\n请前往以下频道使用 \`/draw\` 指令: ${allowedChannels}`,
					ephemeral: true,
				})
			}

			// Get player entity
			const playerEntity = await this.playerRepo.findOneOrFail({
				user: userEntity,
				guild: guildEntity,
			})

			// Initialize default rewards if needed
			await this.drawRewardRepo.initializeDefaultRewards()

			// Check monthly draw limit (10 draws per month, reset on 17th)
			const currentMonthDrawCount = await this.drawHistoryRepo.getCurrentMonthDrawCount(playerEntity)
			const MONTHLY_DRAW_LIMIT = 10

			if (currentMonthDrawCount >= MONTHLY_DRAW_LIMIT) {
				return interaction.followUp({
					content: `🎲 你本月已经抽取了 ${MONTHLY_DRAW_LIMIT} 次奖励，下月重置后再来吧！`,
					ephemeral: true,
				})
			}

			// Get draw cost from config (default: 10 silver per draw)
			const drawCostConfig = await this.configRepo.get('drawCost', guildEntity)
			const DRAW_COST = drawCostConfig !== null ? JSON.parse(drawCostConfig.value) : 10

			if (playerEntity.silver < DRAW_COST) {
				return interaction.followUp({
					content: `💰 抽奖需要消耗 ${DRAW_COST} 银币，你当前只有 ${playerEntity.silver} 银币。`,
					ephemeral: true,
				})
			}

			// Get available rewards
			const availableRewards = await this.drawRewardRepo.getEnabledRewards()
			if (availableRewards.length === 0) {
				return interaction.followUp({
					content: '❌ 当前没有可用的奖励，请联系管理员。',
					ephemeral: true,
				})
			}

			// Consume silver for the draw
			await this.playerRepo.updatePlayerValue(
				{ id: playerEntity.id },
				-DRAW_COST,
				'silver'
			)

			// Log the silver consumption
			await this.valueChangeLogRepo.insertLog(
				playerEntity,
				userEntity,
				-DRAW_COST,
				'silver',
				'抽奖消耗'
			)

			// Check monthly limits for special rewards
			const monthly60GameCount = await this.drawHistoryRepo.getCurrentMonthRewardCount(60)
			const monthly100GameCount = await this.drawHistoryRepo.getCurrentMonthRewardCount(100)

			// Perform weighted random selection with limited occurrence for low probability items
			const selectedReward = this.selectRewardWithLimits(availableRewards, monthly60GameCount, monthly100GameCount)

			// Record the draw
			await this.drawHistoryRepo.addDrawRecord(playerEntity, selectedReward)

			// Send special reward notification only for 'other' type rewards
			await this.checkAndSendSpecialNotification(interaction, guildEntity, selectedReward)

			// Apply the reward
			let rewardMessage = ''
			if (selectedReward.type === 'exp' || selectedReward.type === 'silver') {
				if (selectedReward.value > 0) {
					// TODO: Uncomment when ready to distribute rewards
					await this.playerRepo.updatePlayerValue(
						{ id: playerEntity.id },
						selectedReward.value,
						selectedReward.type
					)

					// Log the value change
					await this.valueChangeLogRepo.insertLog(
						playerEntity,
						userEntity,
						selectedReward.value,
						selectedReward.type,
						'抽奖奖励'
					)

					rewardMessage = selectedReward.type === 'exp'
						? `获得了 ${selectedReward.value} 经验值！`
						: `获得了 ${selectedReward.value} 银币！`
				} else {
					rewardMessage = '很遗憾，这次没有获得奖励。'
				}
			} else if (selectedReward.type === 'other') {
				rewardMessage = `恭喜获得特殊奖励：${selectedReward.name}！请联系管理员领取。`
			}

			// Create beautiful result embed
			const userNickname = (interaction.member as any)?.nickname || interaction.user.globalName || interaction.user.username
			const remainingDraws = MONTHLY_DRAW_LIMIT - currentMonthDrawCount - 1

			// Get reward emoji and title based on type and value
			const { emoji, title, description } = this.getRewardDisplay(selectedReward, rewardMessage)

			const embed = new EmbedBuilder()
				.setTitle(`${emoji} ${title}`)
				.setDescription(`**✨ ${selectedReward.name} ✨**\n\n${description}`)
				.setColor(this.getRewardColor(selectedReward))
				.setAuthor({
					name: `${userNickname} 的抽奖结果`,
					iconURL: interaction.user.displayAvatarURL(),
				})
				.addFields([
					{
						name: '💰 消耗银币',
						value: `**${DRAW_COST}** 银币`,
						inline: true,
					},
					{
						name: '💎 剩余银币',
						value: `**${playerEntity.silver}** 银币`,
						inline: true,
					},
					{
						name: '📅 本月抽奖次数',
						value: `**${currentMonthDrawCount + 1}** / **${MONTHLY_DRAW_LIMIT}**`,
						inline: true,
					},
				])
				.setFooter({
					text: `🎰 TOB 抽奖系统 • ${remainingDraws > 0 ? '继续抽奖获得更多奖励!' : '下月重置抽奖次数!'}`,
					iconURL: interaction.guild?.iconURL() || undefined,
				})
				.setTimestamp()

			return interaction.followUp({
				embeds: [embed],
			})
		} catch (error) {
			this.logger.log(`Draw command failed for user ${user.id}: ${error}`, 'error')

			return interaction.followUp({
				content: '❌ 抽奖失败，请稍后再试。',
				ephemeral: true,
			})
		}
	}

	private selectRewardWithLimits(rewards: DrawReward[], monthly60GameCount: number, monthly100GameCount: number): DrawReward {
		// Filter out rewards that have reached their monthly limit
		const availableRewards = rewards.filter((reward) => {
			if (reward.type === 'other' && reward.value === 60 && monthly60GameCount >= 1) {
				return false // $60 game already awarded this month
			}
			if (reward.type === 'other' && reward.value === 100 && monthly100GameCount >= 1) {
				return false // $100 game already awarded this month
			}

			return true
		})

		// If no rewards available (shouldn't happen with exp rewards), return a default reward
		if (availableRewards.length === 0) {
			// Find a safe fallback reward (exp reward with 0 value)
			const fallbackReward = rewards.find(r => r.type === 'exp' && r.value === 0)
			if (fallbackReward) return fallbackReward

			// If no fallback found, return first available reward
			return rewards[0]
		}

		// Create a weighted array based on probabilities
		const weightedRewards: DrawReward[] = []

		for (const reward of availableRewards) {
			// Add each reward multiple times based on its probability (scaled by 100)
			const weight = Math.max(1, Math.round(reward.probability * 100))
			for (let i = 0; i < weight; i++) {
				weightedRewards.push(reward)
			}
		}

		// Select random reward
		const randomIndex = Math.floor(Math.random() * weightedRewards.length)

		return weightedRewards[randomIndex]
	}

	private getRewardDisplay(reward: DrawReward, rewardMessage: string): { emoji: string, title: string, description: string } {
		if (reward.type === 'other') {
			return {
				emoji: '🎁',
				title: '超级大奖！',
				description: `🌟 ${rewardMessage}\n\n💫 恭喜获得稀有奖励！这可是千载难逢的机会！`,
			}
		} else if (reward.value === 0) {
			return {
				emoji: '😅',
				title: '再接再厉',
				description: `💭 ${rewardMessage}\n\n🍀 别灰心，下次一定能抽到好东西！`,
			}
		} else if (reward.value >= 500) {
			return {
				emoji: '🔥',
				title: '超级幸运！',
				description: `🎉 ${rewardMessage}\n\n⭐ 哇！你的运气真是太好了！`,
			}
		} else if (reward.value >= 100) {
			return {
				emoji: '✨',
				title: '不错的收获',
				description: `🎊 ${rewardMessage}\n\n👍 运气不错呢！`,
			}
		} else {
			return {
				emoji: '🎲',
				title: '小有收获',
				description: `💝 ${rewardMessage}\n\n😊 每一点收获都是进步！`,
			}
		}
	}

	private getRewardColor(reward: DrawReward): number {
		if (reward.type === 'other') {
			return 0xFFD700 // Gold for special rewards
		} else if (reward.value === 0) {
			return 0x808080 // Gray for no reward
		} else if (reward.value >= 500) {
			return 0xFF6B6B // Red for high value
		} else if (reward.value >= 100) {
			return 0x4ECDC4 // Teal for medium value
		} else {
			return 0x45B7D1 // Blue for low value
		}
	}

	private async checkAndSendSpecialNotification(
		interaction: CommandInteraction,
		guildEntity: Guild,
		reward: DrawReward
	): Promise<void> {
		// Read test mode from guild config (default to false)
		const testModeConfig = await this.configRepo.get('botTestMode', guildEntity)
		const isTestMode = testModeConfig !== null ? JSON.parse(JSON.parse(testModeConfig.value)) === true : false
		console.log('isTestMode', isTestMode, testModeConfig!.value)

		// In production mode, only send notifications for $60 and $100 games
		// In test mode, send notifications for all 'other' type rewards
		const shouldSendNotification = isTestMode || ((reward.value === 60 || reward.value === 100) && reward.type === 'other')
		console.log('shouldSendNotification', shouldSendNotification, isTestMode, reward.value)
		if (shouldSendNotification) {
			// Send Chinese embed to bigRewardChannel for big prizes
			await this.sendBigRewardNotification(interaction, guildEntity, reward, isTestMode)
		}
	}

	private async sendBigRewardNotification(
		interaction: CommandInteraction,
		guildEntity: Guild,
		reward: DrawReward,
		isTestMode: boolean = false
	): Promise<void> {
		try {
			// Get bigRewardChannel configuration
			const bigRewardChannelConfig = await this.configRepo.get('bigRewardChannel', guildEntity)
			const bigRewardChannels = bigRewardChannelConfig !== null
				? (JSON.parse(bigRewardChannelConfig.value) as string[])
				: []

			if (bigRewardChannels.length === 0) {
				this.logger.log('No big reward channels configured for big reward notifications', 'warn')

				return
			}

			const userNickname = (interaction.member as any)?.nickname || interaction.user.globalName || interaction.user.username

			// Create Chinese embed message for mod channel
			const prizeText = reward.value === 60 ? '$60' : reward.value === 100 ? '$100' : `$${reward.value}`

			const modEmbed = new EmbedBuilder()
				.setTitle('🎁 盲盒大奖中奖通知')
				.setDescription(
					`恭喜 **${userNickname}** 抽中了盲盒里的大奖： **${prizeText}以内任意自选的steam游戏一份！**\n\n`
					+ `请联系 <@368554692512448523> 领奖\n\n`
					+ `该奖品由金币盲盒产出\n`
					+ `金币是达到20级的朋友将要解锁的功能，可以用来给盘口下注、抽盲盒等等\n`
					+ `初次达到20级的朋友将自动获得100金币并解锁公民区（看不到公民区的20级以上朋友可以去社区最上方的"频道和身份组"里选择是否打开显示该区域）`
				)
				.setColor(0xFFD700) // Gold color
				.addFields([
					{
						name: '🏆 中奖用户',
						value: `<@${interaction.user.id}>`,
						inline: true,
					},
					{
						name: '🎯 奖品价值',
						value: prizeText,
						inline: true,
					},
					{
						name: '📅 中奖时间',
						value: new Date().toLocaleString('zh-CN', {
							timeZone: 'America/New_York',
							year: 'numeric',
							month: '2-digit',
							day: '2-digit',
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
						}),
						inline: true,
					},
				])
				.setThumbnail(interaction.user.displayAvatarURL())
				.setFooter({
					text: isTestMode
						? '🧪 TOB 抽奖系统 • 测试模式 • 生产环境中仅$60/$100大奖触发此通知'
						: '🎰 TOB 抽奖系统 • 大奖通知',
					iconURL: interaction.guild?.iconURL() || undefined,
				})
				.setTimestamp()

			// Send to all configured big reward channels
			for (const channelId of bigRewardChannels) {
				try {
					await this.logger.discordChannel(channelId, { embeds: [modEmbed] })
				} catch (error) {
					this.logger.log(`Failed to send big reward notification to channel ${channelId}: ${error}`, 'error')
				}
			}

			const logMessage = isTestMode
				? `[TEST MODE] Big reward notification sent: ${userNickname} won ${prizeText} Steam game`
				: `Big reward notification sent: ${userNickname} won ${prizeText} Steam game`
			this.logger.log(logMessage, 'info')
		} catch (error) {
			this.logger.log(`Error sending big reward notification: ${error}`, 'error')
		}
	}

}
