import { Category } from '@discordx/utilities'
import { CommandInteraction, Guild } from 'discord.js'

import { Discord, Injectable, Slash, SlashGroup } from '@/decorators'
import {
	GuildConfigItem,
	GuildConfigItemRepository,
	Player,
	PlayerRepository,
	Quest,
	QuestRecord,
	QuestRecordRepository,
	QuestRepository,
} from '@/entities'
import { Guard } from '@/guards'
import { Database, Logger } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

@Discord()
@Injectable()
@Category('General')
@SlashGroup({
	name: 'quest',
})
export default class QuestCompleteCommand {

	private playerRepo: PlayerRepository
	private questRepo: QuestRepository
	private questRecordRepo: QuestRecordRepository
	private configRepo: GuildConfigItemRepository
	private missionBroadcastChannel: string[]

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.playerRepo = this.db.get(Player)
		this.questRepo = this.db.get(Quest)
		this.questRecordRepo = this.db.get(QuestRecord)
		this.configRepo = this.db.get(GuildConfigItem)
	}

	@Slash({
		name: 'complete',
		description: '提交任务（管理员会审核是否完成）',
	})
	@SlashGroup('quest')
	@Guard()
	async complete(interaction: CommandInteraction) {
		const user = resolveUser(interaction)
		const guild = resolveGuild(interaction)

		const player = await this.playerRepo.findOneOrFail({ id: `${user!.id}-${guild!.id}` })
		const questRecords = await this.questRecordRepo.find({ taker: player, questEnded: false, needReview: false })
		if (questRecords.length === 0) {
			return interaction.reply({
				content: '你没有正在进行并且需要提交的任务！',
				ephemeral: true,
			})
		}

		// there should be only 1 record
		const currentQuestRecord = questRecords[0]
		currentQuestRecord.needReview = true

		// save to db
		await this.db.em.persistAndFlush(currentQuestRecord)
		const quest = await this.questRepo.findOneOrFail({ id: currentQuestRecord.quest.id })

		const missionBroadcastChannelConfig = await this.configRepo.get('missionBroadcastChannel', player.guild)
		this.missionBroadcastChannel = missionBroadcastChannelConfig !== null
			? (JSON.parse(missionBroadcastChannelConfig.value) as string[])
			: []

		this.missionBroadcastChannel.forEach((channelId) => {
			this.logger.log(`<@${user!.id}>刚刚提交了任务【${quest.name}】`, 'info', true, channelId)
		})

		return interaction.reply({
			content: `TOB 已经为你通知管理员审核你提交的任务【${quest.name}】！`,
			ephemeral: true,
		})
	}

}
