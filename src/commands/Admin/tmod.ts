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
export default class TModCommand {

	private userRepo: UserRepository
	private playerRepo: PlayerRepository
	private guildRepo: GuildRepository
	private valueChangeLogRepo: ValueChangeLogRepository
	private modLogChannel: string[]
	private configRepo: GuildConfigItemRepository

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

	@Slash({ name: 'tmod' })
	@Guard(
		UserPermissions(['Administrator'])
	)
	async tmod(
		@SlashOption({
			name: 'roleid',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.ROLETAG',
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
		roleid: string,
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

		await interaction.deferReply()

		const guild = resolveGuild(interaction)
		const guildEntity = await this.guildRepo.findOneOrFail({ id: guild?.id })

		const modLogChannelConfig = await this.configRepo.get('modLogChannel', guildEntity)
		this.modLogChannel = modLogChannelConfig !== null
			? (JSON.parse(modLogChannelConfig.value) as string[])
			: []

		const failed: string[] = []

		// roleid is discord role id, we want to get all members with this role
		const role = guild!.roles.cache.get(roleid)
		if (!role) {
			return interaction.followUp({
				content: '无法找到该角色，请检查角色 ID 是否正确。',
				ephemeral: true,
			})
		}
		const members = role.members
		if (members.size === 0) {
			return interaction.followUp({
				content: '该角色没有成员，请检查角色 ID 是否正确。',
				ephemeral: true,
			})
		}

		const dctags = members.map(member => member.user.tag)

		for (const dctag of dctags) {
			const updated = await this.updatePlayer(dctag, guildEntity, type, amount, note, interaction)
			if (!updated) {
				failed.push(dctag)
			}
		}

		return interaction.followUp({
			content: `获取到 <@&${roleid}>${dctags.length} 个成员，正在更新...根据成员数量，可能有短时延迟。全部名单请检查日志频道。\n${
				failed.length > 0 ? `\n以下成员已知更新失败：\n${failed.join(', ')}` : ''}`,
			ephemeral: true,
		})
	}

	private async updatePlayer(dcTag: string, guild: Guild, type: 'exp' | 'silver', amount: number, note: string, interaction: CommandInteraction): Promise<boolean> {
		try {
			const player = await this.playerRepo.findOneOrFail(
				{ dcTag, guild },
				{ cache: false, refresh: true }
			)
			await this.db.em.refresh(player!)

			const prevValue = type === 'exp' ? player!.exp : player!.silver
			const valueUpdated = await this.playerRepo.updatePlayerValue({ dcTag, guild }, amount, type)
			if (!valueUpdated) {
				return false
			}
			const postValue = type === 'exp' ? player!.exp : player!.silver

			const interactionUser = resolveUser(interaction)
			const admin = await this.userRepo.findOneOrFail({ id: interactionUser!.id })
			await this.valueChangeLogRepo.insertLog(player!, admin!, amount, type, note)
			await this.db.em.refresh(player!)
			const infoStr = `<@${interactionUser!.id}> 刚刚更改了 <@${player!.user.id}> 的 ${type} ${amount}.\n原数值：${prevValue}\n新数值：${postValue}\n备注：${note}`
			this.modLogChannel.forEach((channelId) => {
				this.logger.log(infoStr, 'info', true, channelId)
			})

			return true
		} catch (error) {
			return false
		}
	}

}
