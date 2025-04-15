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
export default class ConfigDelCommand {

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
		name: 'del',
		description: '删除配置项目',
	})
	@Guard(
		UserPermissions(['Administrator'])
	)
	@SlashGroup('config')
	@Guard()
	async del(
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
		type: 'channel' | 'role' | 'user',
		interaction: CommandInteraction
	) {
		if (!['channel', 'role', 'user'].includes(type)) {
			return interaction.reply({
				content: '设置类型必须是 `channel` 或 `role` 或 `user`',
				ephemeral: true,
			})
		}

		// await interaction.deferReply()
		const guild = resolveGuild(interaction)

		const configGuild = await this.guildRepo.findOne({ id: guild!.id })
		if (!configGuild) return

		const configItem = await this.configRepo.get(name, configGuild)
		if (!configItem) {
			return interaction.reply({
				content: `没有找到 ${name} 的相关配置`,
				ephemeral: true,
			})
		} else {
			const configItemArray = JSON.parse(configItem.value)
			// TODO: validation?
			const index = configItemArray.indexOf(value)
			if (index > -1) {
				// remove the index-th item from the array
				const resultArray = configItemArray.filter((item: string) => item !== value)
				// If the array is empty, delete the config item
				if (resultArray.length === 0) {
					await this.configRepo.getEntityManager().remove(configItem).flush()

					return interaction.reply({
						content: `已从 ${name} 的配置中成功删除 ${value}，由于没有剩余有效值， ${name} 的配置已被彻底删除`,
						ephemeral: true,
					})
				} else {
					await this.configRepo.set(name, resultArray, type, configGuild)

					return interaction.reply({
						content: `已从 ${name} 的配置中成功删除 ${value}`,
						ephemeral: true,
					})
				}
			} else {
				return interaction.reply({
					content: `${value} 不存在于 ${name} 的配置中，请检查`,
					ephemeral: true,
				})
			}
		}
	}

}
