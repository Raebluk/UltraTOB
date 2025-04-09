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
export default class ConfigMissionCommand {

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
		name: 'mission',
		description: '添加自动监控任务',
	})
	@Guard(
		UserPermissions(['Administrator'])
	)
	@SlashGroup('config')
	@Guard()
	async mission(
		@SlashOption({
			name: 'quest_id',
			localizationSource: 'COMMANDS.CONFIG.OPTIONS.QUEST',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		@SlashOption({
			name: 'emoji_id',
			localizationSource: 'COMMANDS.CONFIG.OPTIONS.EMOJI',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		@SlashOption({
			name: 'channel_id',
			localizationSource: 'COMMANDS.CONFIG.OPTIONS.CHANNEL',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		@SlashOption({
			name: 'reward',
			localizationSource: 'COMMANDS.CONFIG.OPTIONS.REWARD',
			type: ApplicationCommandOptionType.Number,
			required: true,
		})
        @SlashOption({
        	name: 'reward_type',
        	localizationSource: 'COMMANDS.CONFIG.OPTIONS.REWARDTYPE',
        	type: ApplicationCommandOptionType.String,
        	required: true,
        })
		questId: string,
		emojiId: string,
		channelId: string,
		reward: number,
		rewardType: 'exp' | 'silver',
		interaction: CommandInteraction
	) {
		await interaction.deferReply()
		const guild = resolveGuild(interaction)

		const configGuild = await this.guildRepo.findOne({ id: guild!.id })
		if (!configGuild) return

		const quest = await this.questRepo.findOne({ id: questId })
		if (!quest) {
			return interaction.followUp({
				content: `任务 ${questId} 不存在，请检查输入的任务ID`,
				ephemeral: true,
			})
		}

		if (reward <= 0) {
			const configItem = await this.configRepo.get(questId, configGuild)
			if (!configItem) {
				return interaction.followUp({
					content: `Hello? 任务 ${questId} 的监控根本不存在啊，wdym?`,
					ephemeral: true,
				})
			}
			await this.db.em.removeAndFlush(configItem)

			return interaction.followUp({
				content: `任务 ${questId} 的监控已从数据库中移除`,
				ephemeral: true,
			})
		}

		const payload = {
			emojiId,
			channelId,
			reward,
			rewardType,
		}

		// check if the quest is already being monitored
		const existingConfigItem = await this.configRepo.findOne({
			guild: configGuild,
			name: questId,
		})

		if (existingConfigItem) {
			return interaction.followUp({
				content: `任务 ${questId} 的监控已经存在，无法重复添加`,
				ephemeral: true,
			})
		}

		// create a new config item
		const returnItem = await this.configRepo.set(questId, payload, 'mission', configGuild)

		return interaction.followUp({
			content: `${returnItem.name} 设置为 ${returnItem.value}`,
			ephemeral: true,
		})
	}

}
