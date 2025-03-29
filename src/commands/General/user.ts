import { Category } from '@discordx/utilities'
import { LoggerRequestFields } from '@tsed/common'
import {
	AttachmentBuilder,
	CommandInteraction,
	EmbedBuilder,
	GuildMember,
	GuildMemberRoleManager,
} from 'discord.js'

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

const totalExpLevelMapping: Record<number, number> = {
	5: 60,
	10: 320,
	15: 1285,
	20: 4845,
	25: 16675,
	30: 31675,
	35: 46675,
	40: 61675,
	45: 76675,
	50: 91675,
	55: 106675,
	60: 121675,
	65: 136675,
	70: 151675,
	75: 166675,
}

// TODO: this is hard coded, need to find a way to improve
const levelRoleMapping: Record<number, string> = {
	10: '1337585523887177813',
	15: '1351008487571980381',
	20: '1351007105355747390',
	25: '1351007307277926511',
	30: '1351009018918735923',
	35: '1351009016590897183',
	40: '1351009009393598475',
	45: '1351009014506586183',
	50: '1351009012228947968',
	55: '1351009969566257224',
	60: '1351009956370841600',
	65: '1351009941321941053',
	70: '1351009944253497416',
	75: '1351009950964645970',
}

@Discord()
@Injectable()
@Category('General')
export default class UserCommand {

	private userRepo: UserRepository
	private playerRepo: PlayerRepository
	private guildRepo: GuildRepository
	private counterRepo: DailyCounterRepository
	private configRepo: GuildConfigItemRepository

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

	@Slash({
		name: 'user',
		description: '查看你的社区资料',
	})
	@Guard()
	async user(interaction: CommandInteraction) {
		await interaction.deferReply()

		await this.playerRepo.getEntityManager().flush()
		await this.counterRepo.getEntityManager().flush()

		const guild = resolveGuild(interaction)
		const user = resolveUser(interaction)

		const guildEntity = await this.guildRepo.findOneOrFail({ id: guild!.id })
		const userEntity = await this.userRepo.findOneOrFail({ id: user!.id })

		const userCommandAllowedConfig = await this.configRepo.get('userCommandAllowed', guildEntity)
		const userCommandAllowed = userCommandAllowedConfig !== null
			? (JSON.parse(userCommandAllowedConfig.value) as string[])
			: []

		if (!userCommandAllowed.includes(interaction.channelId)) {
			const allowedChannels = userCommandAllowed.map(channelId => `<#${channelId}>`).join(', ')

			return interaction.followUp({
				content: `由于 TOB 的放射性危害，有关部门已经规定:\nTOB 的 \`/user\` 指令需要前往以下频道执行: ${allowedChannels}！`,
				ephemeral: true,
			})
		}

		const userNickname = (interaction.member as any)?.nickname || interaction.user.globalName || interaction.user.username
		const userTag = interaction.user.tag

		const expDoubleLimitConfig = await this.configRepo.get('expDoubleLimit', guildEntity)
		const expDoubleLimit = expDoubleLimitConfig !== null ? JSON.parse(expDoubleLimitConfig!.value) : 4845

		const playerProfile = await this.playerRepo.findOne(
			{ user: userEntity, guild: guildEntity },
			{ cache: false, refresh: true }
		)
		if (!playerProfile) {
			return interaction.editReply({
				content: `不可能！绝对不可能！@${userTag} 的资料竟然消失在了虚空之中...`,
			})
		}

		// check level roles
		this.checkAndAssignLevelRoles(interaction, playerProfile)

		const payload = {
			dcName: userNickname,
			dcId: userEntity.id,
			dcTag: userTag,
			exp: playerProfile.exp,
			avatarId: interaction.user.avatar,
			qualified: true,
		}

		// TODO: save to database
		const playerQualifiedRequiredConfig = await this.configRepo.get('playerQualifiedRequired', guildEntity)
		const playerQualifiedRequired = playerQualifiedRequiredConfig !== null
			? (JSON.parse(playerQualifiedRequiredConfig.value) as string[])
			: []

		const memberRoles = (interaction.member!.roles as GuildMemberRoleManager).cache.map(role => role.id)
		const hasRequiredRoles = playerQualifiedRequired.every(roleId => memberRoles.includes(roleId))
		if (!hasRequiredRoles) {
			payload.qualified = false
		}

		const apiUrl = new URL('/usercard', 'http://127.0.0.1:3721')
		const serverResponse = await fetch(apiUrl.toString(), {
			method: 'POST',
			mode: 'cors',
			cache: 'no-cache',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
			},
			redirect: 'follow',
			referrerPolicy: 'no-referrer',
			body: JSON.stringify(payload),
		})

		if (serverResponse.status !== 200) {
			return interaction.editReply({
				content: 'TOB 费了九牛二虎之力也没有找到你的信息。请联系管理员或稍后再试！',
			})
		}

		let counter = await this.counterRepo.findOne({ player: playerProfile }, { cache: false, refresh: true })
		if (!counter) {
			this.logger.log('Not found daily counter for the player, initializing...', 'info')
			counter = await this.counterRepo.initCounter(playerProfile)
		}

		const { embed, attachment } = this.buildPlayerInfoEmbed(playerProfile, counter, userTag, userNickname, expDoubleLimit)

		const replayStr = payload.qualified
			? 'TOB 刚刚在堆积如山的资料中翻出了你的档案...'
			: 'o|>_<|o 根据资料显示，你已有的数据保存完好，但你需要完成初始任务来继续积累经验\n1. 阅读【社区规则】并点击下方反应（表情）\n2. 阅读【频道指南】并点击下方反应（表情）'

		return interaction.editReply({
			content: replayStr,
			embeds: [embed],
			files: [attachment],
		})
	}

	private async checkAndAssignLevelRoles(interaction: CommandInteraction, playerProfile: Player) {
		const rolesToAdd: string[] = []
		const rolesToRemove: string[] = []

		for (const [level, expRequired] of Object.entries(totalExpLevelMapping)) {
			if (playerProfile.exp >= expRequired) {
				rolesToAdd.push(levelRoleMapping[Number(level)])
			}
		}

		if (rolesToAdd.length > 1) {
			const lastRole = rolesToAdd.pop()!
			rolesToRemove.push(...rolesToAdd)
			rolesToAdd.length = 0
			rolesToAdd.push(lastRole)
		}

		const member = interaction.member as GuildMember
		const roleManager = member.roles as GuildMemberRoleManager

		// Remove lower-tier roles
		await Promise.all(
			rolesToRemove.map((roleId) => {
				if (roleManager.cache.has(roleId)) {
					roleManager.remove(roleId).catch(() => null)
					this.logger.log(`${roleId} removed from user <@${member.id}>`)
				}

				return null
			})
		)

		// Add higher-tier roles
		await Promise.all(
			rolesToAdd.map((roleId) => {
				if (!roleManager.cache.has(roleId)) {
					roleManager.add(roleId).catch(() => null)
					this.logger.log(`${roleId} added to user <@${member.id}>`)
				}

				return null
			})
		)
	}

	private buildPlayerInfoEmbed(playerProfile: Player, counter: DailyCounter, userTag: string, userNickname: string, expDoubleLimit: number): { embed: EmbedBuilder, attachment: AttachmentBuilder } {
		const attachment = new AttachmentBuilder(`python/store/usercard_${userTag}.jpg`, { name: `usercard_${userTag}.jpg` })
		const embed = new EmbedBuilder()
			.setTitle(`⭐丨${userNickname} 的机密档案已经泄露...丨⭐`)
			.setImage(`attachment://usercard_${userTag}.jpg`)
			.addFields(
				{
					name: '今日发言剩余经验',
					value: `${counter.chatExp}`,
					inline: true,
				},
				{
					name: '今日语音剩余经验',
					value: `${counter.voiceExp}`,
					inline: true,
				},
				{
					name: '重置时间',
					value: '美东时间每晚0点',
					inline: false,
				}
			)
			.setColor('#7A76EB')
			.setTimestamp()
			.setFooter(
				{
					text: '🤖 TOB is watching you!',
				}
			)

		if (playerProfile.exp > expDoubleLimit) {
			embed.addFields(
				{
					name: '金币余额',
					value: `${playerProfile.silver}`,
					inline: true,
				}
			)
		}

		return {
			embed,
			attachment,
		}
	}

}
