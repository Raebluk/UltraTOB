import { Category } from '@discordx/utilities'
import {
	AttachmentBuilder,
	CommandInteraction,
	EmbedBuilder,
	GuildMemberRoleManager,
} from 'discord.js'

import { yzConfig } from '@/configs'
import { Discord, Injectable, Slash } from '@/decorators'
import {
	DailyCounter,
	DailyCounterRepository,
	Guild,
	GuildRepository,
	Player,
	PlayerRepository,
	User,
	UserRepository,
} from '@/entities'
import { Guard } from '@/guards'
import { Database } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

@Discord()
@Injectable()
@Category('General')
export default class UserCommand {

	private userRepo: UserRepository
	private playerRepo: PlayerRepository
	private guildRepo: GuildRepository
	private counterRepo: DailyCounterRepository

	constructor(
		private db: Database
	) {
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
		if (!yzConfig.channels.userCommandAllowed.includes(interaction.channelId)) {
			const allowedChannels = yzConfig.channels.userCommandAllowed.map(channelId => `<#${channelId}>`).join(', ')

			return interaction.reply({
				content: `由于 TOB 的放射性危害，有关部门已经规定:\nTOB 的 \`/user\` 指令需要前往以下频道执行: ${allowedChannels}！`,
				ephemeral: true,
			})
		}

		const userNickname = (interaction.member as any)?.nickname || interaction.user.globalName || interaction.user.username

		const userTag = interaction.user.tag

		const guild = resolveGuild(interaction)
		const user = resolveUser(interaction)
		const guildEntity = await this.guildRepo.findOneOrFail({ id: guild!.id })
		const userEntity = await this.userRepo.findOneOrFail({ id: user!.id })

		const playerProfile = await this.playerRepo.findOneOrFail({ user: userEntity, guild: guildEntity })
		if (!playerProfile) {
			interaction.followUp({
				content: `不可能！绝对不可能！@${userTag} 的资料竟然消失在了虚空之中...`,
				ephemeral: false,
			})
		}

		// Check and assign roles for user based on their level
		const totalExpLevelMapping = {
			5: 90,
			10: 425,
			15: 1680,
			20: 6305,
			25: 19675,
			30: 34675,
			35: 49675,
			40: 64675,
			45: 79675,
			50: 94675,
		}

		const levelRoleMapping = {
			10: '1337585523887177813',
			15: '1351008487571980381',
			20: '1351007105355747390',
			25: '1351007307277926511',
			30: '1351009018918735923',
			35: '1351009016590897183',
			40: '1351009009393598475',
			45: '1351009014506586183',
			50: '1351009012228947968',
		}

		let currentLevel = 0
		for (const [level, exp] of Object.entries(totalExpLevelMapping)) {
			if (playerProfile.exp >= exp) {
				currentLevel = Number.parseInt(level)
			} else {
				break
			}
		}

		const memberCurrentRoles = (interaction.member!.roles as GuildMemberRoleManager).cache
		const currentRoleIds = Object.values(levelRoleMapping)

		// Remove previous level roles
		for (const roleId of currentRoleIds) {
			if (memberCurrentRoles.has(roleId)) {
				await memberCurrentRoles.remove(roleId)
			}
		}

		// Assign the new level role
		if (currentLevel >= 10) {
			const newRoleId = levelRoleMapping[currentLevel]
			if (newRoleId && !memberCurrentRoles.has(newRoleId)) {
				await memberCurrentRoles.add(newRoleId)
			}
		}

		const payload = {
			dcName: userNickname,
			dcId: userEntity.id,
			dcTag: userTag,
			exp: playerProfile.exp,
			avatarId: interaction.user.avatar,
			qualified: true,
		}

		// TODO: save to database
		const requiredRoleIds = yzConfig.roles.playerQualifiedRequired
		const memberRoles = (interaction.member!.roles as GuildMemberRoleManager).cache.map(role => role.id)
		const hasRequiredRoles = requiredRoleIds.every(roleId => memberRoles.includes(roleId))
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
			return interaction.reply({
				content: 'TOB 费了九牛二虎之力也没有找到你的信息。请联系管理员或稍后再试！',
				ephemeral: false,
			})
		}

		const { embed, attachment } = await this.buildPlayerInfoEmbed(playerProfile, userTag, userNickname)

		const replayStr = payload.qualified
			? 'TOB 刚刚在堆积如山的资料中翻出了你的档案...'
			: 'o|>_<|o 根据资料显示，你已有的数据保存完好，但你需要完成初始任务来继续积累经验\n1. 阅读【社区规则】并点击下方反应（表情）\n2. 阅读【频道指南】并点击下方反应（表情）'

		return interaction.reply({
			content: replayStr,
			ephemeral: false,
			embeds: [embed],
			files: [attachment],
		})
	}

	private async buildPlayerInfoEmbed(playerProfile: Player, userTag: string, userNickname: string): Promise<{ embed: EmbedBuilder, attachment: AttachmentBuilder }> {
		const counter = await this.counterRepo.findOneOrFail({ player: playerProfile })
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
					inline: true,
				}
			)
			.setColor('#7A76EB')
			.setTimestamp()
			.setFooter(
				{
					text: '🤖 TOB is watching you!',
				}
			)

		return {
			embed,
			attachment,
		}
	}

}
