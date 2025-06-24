import { Category } from '@discordx/utilities'
import { CommandInteraction } from 'discord.js'

import { Discord, Injectable, Slash, SlashGroup } from '@/decorators'
import {
	DrawRecord,
	DrawRecordRepository,
	Player,
	PlayerRepository,
} from '@/entities'
import { Guard } from '@/guards'
import { Database, Logger } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

@Discord()
@Injectable()
@Category('General')
export default class DrawCommand {

	private drawRecordRepo: DrawRecordRepository
	private playerRepo: PlayerRepository

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.drawRecordRepo = this.db.em.getRepository(DrawRecord)
		this.playerRepo = this.db.em.getRepository(Player)
	}

	@Slash({
		name: 'draw',
		description: '放弃当前任务',
	})
	@Guard()
	async draw(interaction: CommandInteraction) {
		const user = resolveUser(interaction)
		const guild = resolveGuild(interaction)

		const player = await this.playerRepo.findOneOrFail({ id: `${user!.id}-${guild!.id}` })
		const today = new Date()
		today.setHours(0, 0, 0, 0)

		const existingRecord = await this.drawRecordRepo.find({
			drawer: player,
			createdAt: {
				$gte: today,
			},
		})

		if (existingRecord.length !== 0) {
			return interaction.reply({
				content: '今天你已参加过抽奖啦，请明天再来！',
				ephemeral: true,
			})
		}

        drawConfig = 


        // create a new draw and insert new DrawRecord



		// there should be only 1 record
		const currentQuestRecord = questRecords[0]
		currentQuestRecord.failDate = new Date()
		currentQuestRecord.questEnded = true

		// save to db
		await this.db.em.persistAndFlush(currentQuestRecord)
		const quest = await this.questRepo.findOneOrFail({ id: currentQuestRecord.quest.id })

		const missionBroadcastChannelConfig = await this.configRepo.get('missionBroadcastChannel', player.guild)
		this.missionBroadcastChannel = missionBroadcastChannelConfig !== null
			? (JSON.parse(missionBroadcastChannelConfig.value) as string[])
			: []

		this.missionBroadcastChannel.forEach((channelId) => {
			this.logger.log(`<@${user!.id}>刚刚放弃了任务【${quest.name}】`, 'info', true, channelId)
		})

		return interaction.reply({
			content: `TOB 已经为你通知管理员审核你提交的任务【${quest.name}】！`,
			ephemeral: true,
		})
	}

}
