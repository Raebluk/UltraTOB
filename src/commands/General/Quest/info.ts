import { Category } from '@discordx/utilities'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { CommandInteraction, EmbedBuilder } from 'discord.js'

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
import { Database } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

dayjs.extend(relativeTime)

@Discord()
@Injectable()
@Category('General')
@SlashGroup({
	name: 'quest',
})
export default class QuestInfoCommand {

	private playerRepo: PlayerRepository
	private questRepo: QuestRepository
	private questRecordRepo: QuestRecordRepository

	constructor(
		private db: Database
	) {
		this.playerRepo = this.db.get(Player)
		this.questRepo = this.db.get(Quest)
		this.questRecordRepo = this.db.get(QuestRecord)
	}

	@Slash({
		name: 'info',
		description: '查看当前你接受的任务',
	})
	@SlashGroup('quest')
	@Guard()
	async info(interaction: CommandInteraction) {
		const user = resolveUser(interaction)
		const guild = resolveGuild(interaction)

		const player = await this.playerRepo.findOneOrFail({ id: `${user!.id}-${guild!.id}` })
		const questRecords = await this.questRecordRepo.find({ taker: player, questEnded: false })
		if (questRecords.length === 0) {
			return interaction.reply({
				content: '你没有正在进行的任务！',
				ephemeral: true,
			})
		}

		// there should be only 1 record
		const currentQuestRecord = questRecords[0]
		const quest = await this.questRepo.findOneOrFail({ id: currentQuestRecord.quest.id })
		const embed = await this.buildQuestInfoEmbed(interaction, quest, currentQuestRecord)

		return interaction.reply({
			content: '下列是你正在进行的任务信息。',
			ephemeral: true,
			embeds: [embed],
		})
	}

	private async buildQuestInfoEmbed(interaction: CommandInteraction, quest: Quest, questRecord: QuestRecord): Promise<EmbedBuilder> {
		const author = await this.playerRepo.findOneOrFail({ id: quest.publisher.id })

		const embed = new EmbedBuilder()
			.setColor(0x0099FF)
			.setAuthor(
				{
					name: '当前任务信息',
					iconURL: interaction.guild!.iconURL()!,
				}
			)
			.setTitle(quest.name)
			.setDescription(quest.description ? quest.description : '无')
			.addFields(
				{
					name: '任务截止时间',
					value: `${dayjs(quest.expireDate).fromNow()}`,
				},
				{
					name: '任务发布人',
					value: `<@${author.user.id}>`,
				},
				{
					name: '任务奖励',
					value: quest.rewardDescription,
				},
				{
					name: '状态',
					value: questRecord.needReview ? '等待审核' : '进行中',
				}
			)
			.setTimestamp()
			.setFooter(
				{
					text: '🤖 TOB is watching you!',
				}
			)

		return embed
	}

}
