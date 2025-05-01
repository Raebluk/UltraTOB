import { Category } from '@discordx/utilities'
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
	PlayerMetadata,
	PlayerMetadataRepository,
	PlayerRepository,
	User,
	UserRepository,
	ValueChangeLog,
	ValueChangeLogRepository,
} from '@/entities'
import { Guard } from '@/guards'
import { Database, Logger } from '@/services'
import { resolveGuild, resolveUser, updateMemberLevelRoles } from '@/utils/functions'

@Discord()
@Injectable()
@Category('General')
export default class UserCommand {

	private userRepo: UserRepository
	private playerRepo: PlayerRepository
	private guildRepo: GuildRepository
	private counterRepo: DailyCounterRepository
	private configRepo: GuildConfigItemRepository
	private playerMetadataRepo: PlayerMetadataRepository
	private valueChangeLogRepo: ValueChangeLogRepository

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.configRepo = this.db.get(GuildConfigItem)
		this.userRepo = this.db.get(User)
		this.playerRepo = this.db.get(Player)
		this.guildRepo = this.db.get(Guild)
		this.counterRepo = this.db.get(DailyCounter)
		this.playerMetadataRepo = this.db.get(PlayerMetadata)
		this.valueChangeLogRepo = this.db.get(ValueChangeLog)
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
			return interaction.followUp({
				content: `不可能！绝对不可能！@${userTag} 的资料竟然消失在了虚空之中...`,
			})
		}

		// check level roles
		const member = interaction.member as GuildMember
		await updateMemberLevelRoles(member, playerProfile.exp, this.logger)

		// Check if player qualifies for initial silver and hasn't received it yet
		if (playerProfile.exp >= expDoubleLimit) {
			// Find or create player metadata
			let playerMetadata = await this.playerMetadataRepo.findOne({
				user: userEntity,
				guild: guildEntity,
			})

			if (!playerMetadata) {
				// Create new metadata if it doesn't exist
				playerMetadata = new PlayerMetadata()
				playerMetadata.id = playerProfile.id // Use same ID pattern as player
				playerMetadata.user = userEntity
				playerMetadata.guild = guildEntity
				playerMetadata.initSilverGiven = false
				await this.playerMetadataRepo.getEntityManager().persistAndFlush(playerMetadata)
			}

			// If player hasn't received initial silver, give them 100 silver
			if (!playerMetadata.initSilverGiven) {
				// Update player silver
				await this.playerRepo.updatePlayerValue(
					{ id: playerProfile.id },
					100,
					'silver'
				)

				// Log the silver reward
				await this.valueChangeLogRepo.insertLog(
					playerProfile,
					userEntity,
					100,
					'silver',
					'初次达到经验上限奖励'
				)

				// Update metadata to mark silver as given
				playerMetadata.initSilverGiven = true
				await this.playerMetadataRepo.getEntityManager().persistAndFlush(playerMetadata)

				this.logger.log(`Initial silver (100) given to player ${userEntity.id} in guild ${guildEntity.id}`, 'info')
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
			return interaction.followUp({
				content: 'TOB 费了九牛二虎之力也没有找到你的信息。请联系管理员或稍后再试！',
			})
		}

		let counter = await this.counterRepo.findOne({ player: playerProfile }, { cache: false, refresh: true })
		if (!counter) {
			this.logger.log('Not found daily counter for the player, initializing...', 'info')
			counter = await this.counterRepo.initCounter(playerProfile)
		}

		// refresh player profile
		await this.playerRepo.getEntityManager().refresh(playerProfile)
		const { embed, attachment } = this.buildPlayerInfoEmbed(playerProfile, counter, userTag, userNickname, expDoubleLimit)

		const replayStr = payload.qualified
			? 'TOB 刚刚在堆积如山的资料中翻出了你的档案...'
			: 'o|>_<|o 根据资料显示，你已有的数据保存完好，但你需要完成初始任务来继续积累经验\n1. 阅读【社区规则】并点击下方反应（表情）\n2. 阅读【频道指南】并点击下方反应（表情）'

		return interaction.followUp({
			content: replayStr,
			embeds: [embed],
			files: [attachment],
		})
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

		if (playerProfile.exp >= expDoubleLimit) {
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
