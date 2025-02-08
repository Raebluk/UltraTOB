import { Category } from '@discordx/utilities'
import { CommandInteraction } from 'discord.js'

import { yzConfig } from '@/configs'
import { Discord, Injectable, Slash, SlashGroup } from '@/decorators'
import {
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
export default class QuestDropCommand {

	private playerRepo: PlayerRepository
	private questRepo: QuestRepository
	private questRecordRepo: QuestRecordRepository

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.playerRepo = this.db.get(Player)
		this.questRepo = this.db.get(Quest)
		this.questRecordRepo = this.db.get(QuestRecord)
	}

	@Slash({
		name: 'drop',
		description: '放弃当前任务',
	})
	@SlashGroup('quest')
	@Guard()
	async drop(interaction: CommandInteraction) {
		const user = resolveUser(interaction)
		const guild = resolveGuild(interaction)

		const player = await this.playerRepo.findOneOrFail({ id: `${user!.id}-${guild!.id}` })
		const questRecords = await this.questRecordRepo.find({ taker: player, questEnded: false, needReview: false })
		if (questRecords.length === 0) {
			return interaction.reply({
				content: '你没有正在进行的任务！',
				ephemeral: true,
			})
		}

		// there should be only 1 record
		const currentQuestRecord = questRecords[0]
		currentQuestRecord.failDate = new Date()
		currentQuestRecord.questEnded = true

		// save to db
		await this.db.em.persistAndFlush(currentQuestRecord)
		const quest = await this.questRepo.findOneOrFail({ id: currentQuestRecord.quest.id })

		this.logger.log(`<@${user!.id}>刚刚放弃了任务【${quest.name}】`, 'info', true, yzConfig.channels.missionBroadcastChannel)

		return interaction.reply({
			content: `TOB 已经为你通知管理员审核你提交的任务【${quest.name}】！`,
			ephemeral: true,
		})
	}

}
