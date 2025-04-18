import { Category } from '@discordx/utilities'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	CommandInteraction,
	EmbedBuilder,
	MessageActionRowComponentBuilder,
} from 'discord.js'
import { ButtonComponent } from 'discordx'

import { Discord, Injectable, Slash, SlashGroup } from '@/decorators'
import {
	Guild,
	GuildConfigItem,
	GuildConfigItemRepository,
	GuildRepository,
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

dayjs.extend(relativeTime)

@Discord()
@Injectable()
@Category('General')
@SlashGroup({
	name: 'quest',
})
export default class QuestListCommand {

	private playerRepo: PlayerRepository
	private questRepo: QuestRepository
	private guildRepo: GuildRepository
	private questRecordRepo: QuestRecordRepository
	private configRepo: GuildConfigItemRepository
	private currentQuestIdx: number
	private quests: Quest[]
	private missionBroadcastChannel: string[]

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.playerRepo = this.db.get(Player)
		this.questRepo = this.db.get(Quest)
		this.guildRepo = this.db.get(Guild)
		this.questRecordRepo = this.db.get(QuestRecord)
		this.configRepo = this.db.get(GuildConfigItem)
	}

	@Slash({
		name: 'list',
		description: '查看当前公开发布的任务',
	})
	@SlashGroup('quest')
	@Guard()
	async list(interaction: CommandInteraction) {
		const guild = resolveGuild(interaction)
		const guildEntity = await this.guildRepo.findOneOrFail({ id: guild!.id })

		const missionBroadcastChannelConfig = await this.configRepo.get('missionBroadcastChannel', guildEntity)
		this.missionBroadcastChannel = missionBroadcastChannelConfig !== null
			? (JSON.parse(missionBroadcastChannelConfig.value) as string[])
			: []

		this.currentQuestIdx = 0
		// find all quests that expire date is greater than now
		this.quests = await this.questRepo.find({
			expireDate: {
				$gt: new Date(),
			},
			manual: true,
			guild: guildEntity,
		})

		if (this.quests.length === 0) {
			return interaction.reply({
				content: '现在没有可接任务。',
				ephemeral: true,
			})
		}

		const { embed, buttons } = await this.buildQuestListInfoEmbed(interaction)

		return interaction.reply({
			embeds: [embed],
			components: [buttons],
			ephemeral: true,
		})
	}

	private async buildQuestListInfoEmbed(interaction: CommandInteraction | ButtonInteraction): Promise<{ embed: EmbedBuilder, buttons: ActionRowBuilder<MessageActionRowComponentBuilder> }> {
		const author = await this.playerRepo.findOneOrFail({ id: this.quests[this.currentQuestIdx].publisher.id })

		const questToShow = this.quests[this.currentQuestIdx]
		const questDescription = questToShow.description ? questToShow.description : '无'
		const questName = questToShow.name
		const questReward = questToShow.rewardDescription
		const questExpireTime = questToShow.expireDate

		const embed = new EmbedBuilder()
			.setColor(0x0099FF)
			.setAuthor(
				{
					name: '社区任务板最新发布！',
					iconURL: interaction.guild!.iconURL()!,
				}
			)
			.setDescription(questDescription)
			.addFields(
				{
					name: '任务名称',
					value: questName,
				},
				{
					name: '任务奖励',
					value: questReward,
				},
				{
					name: '任务截止时间 (UTC)',
					value: `${questExpireTime.toDateString()} - ${dayjs(questExpireTime).fromNow()}`,
				},
				{
					name: '任务发布人',
					value: `<@${author.user.id}>`,
				}
			)
			.setTimestamp()
			.setFooter(
				{
					text: `共${this.quests.length}个可接任务，这是第${this.currentQuestIdx + 1}个任务`,
				}
			)

		const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>()
		if (this.currentQuestIdx !== 0) {
			buttons.addComponents(
				new ButtonBuilder()
					.setCustomId('prev-quest')
					.setLabel('<- 前一个')
					.setStyle(ButtonStyle.Primary)
			)
		}
		buttons.addComponents(
			new ButtonBuilder()
				.setCustomId('accept-quest')
				.setLabel('✅ 接受任务')
				.setStyle(ButtonStyle.Success)
		)
		if (this.currentQuestIdx !== this.quests.length - 1) {
			buttons.addComponents(
				new ButtonBuilder()
					.setCustomId('next-quest')
					.setLabel('下一个 ->')
					.setStyle(ButtonStyle.Primary)
			)
		}

		return { embed, buttons }
	}

	@ButtonComponent({ id: 'accept-quest' })
	async handleAcceptQuestButton(interaction: ButtonInteraction) {
		const user = resolveUser(interaction)
		const guild = resolveGuild(interaction)

		const player = await this.playerRepo.findOneOrFail({ id: `${user!.id}-${guild!.id}` })
		const questRecords = await this.questRecordRepo.find({ taker: player, questEnded: false })
		// check if having other quests
		if (questRecords.length > 0) {
			return interaction.reply({
				content: '你已经有一个任务在进行中了，请先完成或者放弃任务后再接受新的任务。',
				ephemeral: true,
			})
		} else {
			const currentQuest = this.quests[this.currentQuestIdx]
			this.questRecordRepo.insertQuestRecord(currentQuest, player)

			this.missionBroadcastChannel.forEach((channelId) => {
				this.logger.log(`<@${player.user.id}> 已经接受了任务【${currentQuest.name}】`, 'info', true, channelId)
			})

			return interaction.reply({
				content: `任务【${currentQuest.name}】现在开始咯！`,
				ephemeral: true,
			})
		}
	}

	@ButtonComponent({ id: 'next-quest' })
	async handleNextQuestButton(interaction: ButtonInteraction) {
		await interaction.deferUpdate()
		this.currentQuestIdx += 1
		const { embed, buttons } = await this.buildQuestListInfoEmbed(interaction)

		interaction.editReply({
			embeds: [embed],
			components: [buttons],
		})
	}

	@ButtonComponent({ id: 'prev-quest' })
	async handlePrevQuestButton(interaction: ButtonInteraction) {
		await interaction.deferUpdate()
		this.currentQuestIdx -= 1
		const { embed, buttons } = await this.buildQuestListInfoEmbed(interaction)

		interaction.editReply({
			embeds: [embed],
			components: [buttons],
		})
	}

}