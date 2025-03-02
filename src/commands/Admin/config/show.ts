import { Category } from '@discordx/utilities'
import { CommandInteraction, EmbedBuilder } from 'discord.js'

import { Discord, Injectable, Slash, SlashGroup } from '@/decorators'
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
export default class ConfigShowCommand {

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
		name: 'show',
		description: '显示当前所有配置项目',
	})
	@Guard(
		UserPermissions(['Administrator'])
	)
	@SlashGroup('config')
	@Guard()
	async show(interaction: CommandInteraction) {
		await interaction.deferReply()
		const guild = resolveGuild(interaction)

		const configGuild = await this.guildRepo.findOne({ id: guild!.id })
		if (!configGuild) return

		const configs = await this.configRepo.getAllConfigByGuild(configGuild)
		const embed = await this.buildGuildConfigEmbed(interaction, configs)

		return interaction.followUp({
			embeds: [embed],
			ephemeral: true,
		})
	}

	private async buildGuildConfigEmbed(interaction: CommandInteraction, configs: GuildConfigItem[]): Promise<EmbedBuilder> {
		const embed = new EmbedBuilder()
			.setColor(0x0099FF)
			.setAuthor(
				{
					name: '社区Bot设定参数一览',
					iconURL: interaction.guild!.iconURL()!,
				}
			)
			.setDescription('请仔细检查下列社区参数设定')
			.setTimestamp()

		for (const config of configs) {
			let value = JSON.parse(config.value)
			// double parsing needed here
			if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
				value = JSON.parse(value)
			}
			if (Array.isArray(value)) {
				console.log('array')
				value = value
					.map((v) => {
						if (config.type === 'user') {
							return `<@${v}>` // Mention user
						} else if (config.type === 'channel') {
							return `<#${v}>` // Mention channel
						} else if (config.type === 'role') {
							return `<@&${v}>` // Mention role
						}

						return v
					})
					.join(', ')
			} else {
				// Format value based on type
				if (config.type === 'user') {
					value = `<@${value}>` // Mention user
				} else if (config.type === 'channel') {
					value = `<#${value}>` // Mention channel
				} else if (config.type === 'role') {
					value = `<@&${value}>` // Mention role
				}
			}

			embed.addFields({
				name: config.name,
				value: value || '未设置',
				inline: false,
			})
		}

		return embed
	}

}
