import { Category } from '@discordx/utilities'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CommandInteraction, EmbedBuilder, MessageActionRowComponentBuilder } from 'discord.js'
import { ButtonComponent } from 'discordx'

import { Discord, Injectable, Slash, SlashGroup } from '@/decorators'
import { Player, PlayerRepository, Quest, QuestRepository, User } from '@/entities'
import { Guard } from '@/guards'
import { Database, Stats } from '@/services'

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
	private currentQuestIdx: number
	private quests: Quest[]

	constructor(
		private stats: Stats,
		private db: Database
	) {
		this.playerRepo = db.get(Player)
		this.questRepo = db.get(Quest)
		this.currentQuestIdx = 0
	}

	@Slash({
		name: 'list',
		description: '查看当前公开发布的任务',
	})
	@SlashGroup('quest')
	@Guard()
	async list(interaction: CommandInteraction) {
		// find all quests that expire date is greater than now
		this.quests = await this.questRepo.find({
			expireDate: {
				$gt: new Date(),
			},
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
		const currentQuest = this.quests[this.currentQuestIdx]
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