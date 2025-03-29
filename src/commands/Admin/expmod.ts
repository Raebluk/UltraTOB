import { Category } from '@discordx/utilities'
import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js'

import { Discord, Injectable, Slash, SlashOption } from '@/decorators'
import {
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
import { Guard, UserPermissions } from '@/guards'
import { Database, Logger } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

@Discord()
@Injectable()
@Category('Admin')
export default class VModCommand {

	private userRepo: UserRepository
	private playerRepo: PlayerRepository
	private guildRepo: GuildRepository
	private valueChangeLogRepo: ValueChangeLogRepository
	private configRepo: GuildConfigItemRepository
	private modLogChannel: string[]

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.userRepo = this.db.get(User)
		this.playerRepo = this.db.get(Player)
		this.guildRepo = this.db.get(Guild)
		this.valueChangeLogRepo = this.db.get(ValueChangeLog)
		this.configRepo = this.db.get(GuildConfigItem)
	}

	@Slash({ name: 'vmod' })
	@Guard(
		UserPermissions(['Administrator'])
	)
	async vmod(
		@SlashOption({
			name: 'dctag',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.DCTAG',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		@SlashOption({
			name: 'type',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.TYPE',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		@SlashOption({
			name: 'amount',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.AMOUNT',
			type: ApplicationCommandOptionType.Number,
			required: true,
		})
		@SlashOption({
			name: 'note',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.NOTE',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		dcTag: string,
		type: 'exp' | 'silver',
		amount: number,
		note: string,
		interaction: CommandInteraction
	) {
		// make sure type is either `exp` or `silver`
		if (!['exp', 'silver'].includes(type)) {
			return interaction.reply({
				content: '编辑类型必须是 `exp` 或 `silver`',
				ephemeral: true,
			})
		}
		await this.playerRepo.getEntityManager().flush()

		const guild = resolveGuild(interaction)
		const guildEntity = await this.guildRepo.findOneOrFail({ id: guild?.id })
		const player = await this.playerRepo.findOne(
			{ dcTag, guild: guildEntity },
			{ cache: false, refresh: true }
		)
		if (!player) {
			return interaction.reply({
				content: '在服务器内无法找到该用户，请联系管理员。',
			})
		}

		const modLogChannelConfig = await this.configRepo.get('missionBroadcastChannel', guildEntity)
		this.modLogChannel = modLogChannelConfig !== null
			? (JSON.parse(modLogChannelConfig.value) as string[])
			: []

		await this.db.em.refresh(player!)
		const prevValue = type === 'exp' ? player!.exp : player!.silver
		const valueUpdated = await this.playerRepo.updatePlayerValue({ dcTag, guild: guildEntity }, amount, type)
		if (!valueUpdated) {
			return interaction.reply({ content: `用户 ${dcTag} 不存在于该服务器 ${guildEntity.id}，请联系管理员。` })
		}
		await this.db.em.refresh(player!)
		const postValue = type === 'exp' ? player!.exp : player!.silver

		const interactionUser = resolveUser(interaction)
		const admin = await this.userRepo.findOneOrFail({ id: interactionUser!.id })
		await this.valueChangeLogRepo.insertLog(player!, admin!, amount, type, note)

		const infoStr = `<@${interactionUser!.id}> 刚刚更改了 <@${player!.user.id}> 的 ${type} ${amount}.\n原数值：${prevValue}\n新数值：${postValue}\n备注：${note}`

		this.modLogChannel.forEach((channelId) => {
			this.logger.log(infoStr, 'info', true, channelId)
		})

		return interaction.reply({
			content: infoStr,
			ephemeral: true,
		})
	}

}
