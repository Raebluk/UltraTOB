import { Category } from '@discordx/utilities'
import {
	ApplicationCommandOptionType,
	CommandInteraction,
} from 'discord.js'

import {
	Discord,
	Injectable,
	Slash,
	SlashGroup,
	SlashOption,
} from '@/decorators'
import {
	Guild,
	GuildConfigItem,
	GuildConfigItemRepository,
	GuildRepository,
} from '@/entities'
import { Guard, UserPermissions } from '@/guards'
import { Database, Logger } from '@/services'
import { resolveGuild } from '@/utils/functions'

@Discord()
@Injectable()
@Category('Admin')
@SlashGroup({
	name: 'config',
})
export default class ConfigAddCommand {

	private configRepo: GuildConfigItemRepository
	private guildRepo: GuildRepository

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.configRepo = this.db.get(GuildConfigItem)
		this.guildRepo = this.db.get(Guild)
	}

	@Slash({
		name: 'add',
		description: '添加配置项目',
	})
	@Guard(
		UserPermissions(['Administrator'])
	)
	@SlashGroup('config')
	@Guard()
	async add(
		@SlashOption({
			name: 'name',
			localizationSource: 'COMMANDS.CONFIG.OPTIONS.NAME',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		@SlashOption({
			name: 'value',
			localizationSource: 'COMMANDS.CONFIG.OPTIONS.VALUE',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		@SlashOption({
			name: 'type',
			localizationSource: 'COMMANDS.CONFIG.OPTIONS.TYPE',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		name: string,
		value: string,
		type: 'channel' | 'role' | 'user' | 'value',
		interaction: CommandInteraction
	) {
		if (!['channel', 'role', 'user', 'value'].includes(type)) {
			return interaction.reply({
				content: '设置类型必须是 `channel` 或 `role` 或 `user`',
				ephemeral: true,
			})
		}

		await interaction.deferReply()
		const guild = resolveGuild(interaction)

		const configGuild = await this.guildRepo.findOne({ id: guild!.id })
		if (!configGuild) return

		const configItem = await this.configRepo.get(name, configGuild)
		let returnItem: GuildConfigItem
		if (!configItem) {
			returnItem = await this.configRepo.set(name, value, type, configGuild)
		} else {
			if (configItem.type !== 'value') {
				let configItemArray = JSON.parse(configItem.value)
				// TODO: validation?
				if (!Array.isArray(configItemArray)) {
					// set configItemArray to empty array
					configItemArray = []
				}
				configItemArray.push(value)
				returnItem = await this.configRepo.set(name, configItemArray, type, configGuild)
			} else {
				returnItem = await this.configRepo.set(name, value, type, configGuild)
			}
		}

		return interaction.followUp({
			content: `${returnItem.name} 设置为 ${returnItem.value}`,
			ephemeral: true,
		})
	}

}
