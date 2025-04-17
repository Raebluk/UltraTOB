import { Category } from '@discordx/utilities'
import { CommandInteraction, EmbedBuilder } from 'discord.js'

import { Discord, Injectable, Slash, SlashGroup } from '@/decorators'
import {
	Guild,
	GuildConfigItem,
	GuildConfigItemRepository,
	GuildRepository,
	Quest,
	QuestRepository,
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
export default class ConfigMShowCommand {

	private configRepo: GuildConfigItemRepository
	private guildRepo: GuildRepository
	private questRepo: QuestRepository

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.configRepo = this.db.get(GuildConfigItem)
		this.guildRepo = this.db.get(Guild)
		this.questRepo = this.db.get(Quest)
	}

	@Slash({
		name: 'mshow',
		description: '显示当前所有已配置任务和待配置任务',
	})
	@Guard(
		UserPermissions(['Administrator'])
	)
	@SlashGroup('config')
	@Guard()
	async mshow(interaction: CommandInteraction) {
		await interaction.deferReply()
		const guild = resolveGuild(interaction)

		const configGuild = await this.guildRepo.findOne({ id: guild!.id })
		if (!configGuild) return

		const configs = await this.configRepo.getAllByType(configGuild, 'mission')
		const embed = await this.buildGuildMissionConfigEmbed(interaction, configs, configGuild)

		return interaction.followUp({
			embeds: [embed],
			ephemeral: true,
		})
	}

	private async buildGuildMissionConfigEmbed(interaction: CommandInteraction, configs: GuildConfigItem[], configGuild: Guild): Promise<EmbedBuilder> {
		const embed = new EmbedBuilder()
			.setColor(0x0099FF)
			.setAuthor(
				{
					name: '社区监控任务一览',
					iconURL: interaction.guild!.iconURL()!,
				}
			)
			.setDescription('请仔细检查下列社区任务监控设定')
			.setTimestamp()
		const seen = []
		for (const config of configs) {
			let value = JSON.parse(config.value)
			// double parsing needed here
			if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
				value = JSON.parse(value)
			}
			value.channelId = value.channelId ? `<#${value.channelId}>` : '未设置'
			embed.addFields({
				name: config.name,
				value: JSON.stringify(value) || '未设置',
				inline: false,
			})
			seen.push(config.name)
		}

		const allQuests = await this.questRepo.find({ guild: configGuild, expireDate: { $gt: new Date() }, manual: false })
		if (allQuests.length > 0) {
			// for each quest that are not in seen, add them to the embed
			for (const quest of allQuests) {
				if (!seen.includes(quest.id)) {
					embed.addFields({
						name: '待设置任务',
						value: `任务名：<${quest.name}>\n任务ID：${quest.id}\n任务过期时间：${quest.expireDate.toLocaleString()}`,
						inline: false,
					})
				}
			}
		}

		return embed
	}

}
