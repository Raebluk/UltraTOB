import { Category } from '@discordx/utilities'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	Client,
	CommandInteraction,
	EmbedBuilder,
	MessageActionRowComponentBuilder,
	ModalBuilder,
	ModalSubmitInteraction,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js'
import { ButtonComponent, ModalComponent } from 'discordx'

import { yzConfig } from '@/configs'
import { Discord, Injectable, Slash, SlashGroup } from '@/decorators'
import {
	Player,
	PlayerRepository,
	Quest,
	QuestRecord,
	QuestRecordRepository,
	QuestRepository,
	User,
	UserRepository,
	ValueChangeLog,
	ValueChangeLogRepository,
} from '@/entities'
import { Guard, UserPermissions } from '@/guards'
import { Database, Logger } from '@/services'
import { resolveUser } from '@/utils/functions'

dayjs.extend(relativeTime)

@Discord()
@Injectable()
@Category('General')
@SlashGroup({
	name: 'quest',
})
export default class QuestReviewCommand {

	private userRepo: UserRepository
	private playerRepo: PlayerRepository
	private questRepo: QuestRepository
	private questRecordRepo: QuestRecordRepository
	private valueChangeLogRepo: ValueChangeLogRepository
	private currentQuestIdx: number
	private questRecords: QuestRecord[]

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.userRepo = this.db.get(User)
		this.playerRepo = this.db.get(Player)
		this.questRepo = this.db.get(Quest)
		this.questRecordRepo = this.db.get(QuestRecord)
		this.valueChangeLogRepo = this.db.get(ValueChangeLog)
	}

	@Slash({
		name: 'review',
		description: '审核任务（仅限管理）',
	})
	@SlashGroup('quest')
	@Guard(
		UserPermissions(['Administrator'])
	)
	async review(interaction: CommandInteraction) {
		this.questRecords = await this.questRecordRepo.find({ questEnded: false, needReview: true })
		if (this.questRecords.length === 0) {
			return interaction.reply({
				content: '没有正在需要审核的任务！',
				ephemeral: true,
			})
		}

		// need this.currentQuestIdx in this.buildQuestListInfoEmbed
		this.currentQuestIdx = 0
		const { embed, buttons } = await this.buildQuestReviewListInfoEmbed(interaction)

		return interaction.reply({
			embeds: [embed],
			components: [buttons],
			ephemeral: true,
		})
	}

	private async buildQuestReviewListInfoEmbed(interaction: CommandInteraction | ButtonInteraction): Promise<{ embed: EmbedBuilder, buttons: ActionRowBuilder<MessageActionRowComponentBuilder> }> {
		const questToShow = this.questRecords[this.currentQuestIdx]
		const player = await this.playerRepo.findOneOrFail({ id: questToShow.taker.id })
		const quest = await this.questRepo.findOneOrFail({ id: questToShow.quest.id })
		const questName = quest.name
		const submitter = player.user.id

		const member = interaction.guild!.members.cache.get(submitter)
		const displayName = (member!.nickname ? member!.nickname : member!.user.globalName) || member!.user.username

		const embed = new EmbedBuilder()
			.setColor(0x0099FF)
			.setTitle(`任务审核 - ${questName}`)
			.setAuthor(
				{
					name: displayName,
					iconURL: `https://cdn.discordapp.com/avatars/${submitter}/${member!.user.avatar}.png`,
					url: `https://discord.com/users/${submitter}`,
				}
			)
			.addFields(
				{
					name: '任务名称',
					value: questName,
				},
				{
					name: '提交人',
					value: `<@${player.user.id}>`,
				}
			)
			.setTimestamp()
			.setFooter(
				{
					text: `共${this.questRecords.length}个待审核任务，这是第${this.currentQuestIdx + 1}个任务`,
				}
			)

		const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>()
		buttons.addComponents(
			new ButtonBuilder()
				.setCustomId('approve-completion')
				.setLabel('✅ 批准完成任务')
				.setStyle(ButtonStyle.Success)
		)
		buttons.addComponents(
			new ButtonBuilder()
				.setCustomId('reject-completion')
				.setLabel('❌ 驳回完成任务')
				.setStyle(ButtonStyle.Danger)
		)
		if (this.currentQuestIdx > 0) {
			buttons.addComponents(
				new ButtonBuilder()
					.setCustomId('prev-review-quest')
					.setLabel('<- 前一个')
					.setStyle(ButtonStyle.Primary)
			)
		}
		if (this.currentQuestIdx !== this.questRecords.length - 1) {
			buttons.addComponents(
				new ButtonBuilder()
					.setCustomId('next-review-quest')
					.setLabel('下一个 ->')
					.setStyle(ButtonStyle.Primary)
			)
		}

		return { embed, buttons }
	}

	private async buildQuestCompletionApproveModal(questRecord: QuestRecord): Promise<ModalBuilder> {
		// TODO: try to avoid it to be async
		const player = await this.playerRepo.findOneOrFail({ id: questRecord.taker.id })
		const quest = await this.questRepo.findOneOrFail({ id: questRecord.quest.id })

		const modal = new ModalBuilder()
			.setCustomId('quest-completion-approve-modal')
			.setTitle('批准任务完成')

		const questRecordIdInput = new TextInputBuilder()
			.setCustomId('quest-name-input')
			.setLabel('任务名称（不要更改）')
			.setValue(quest.name)
			.setStyle(TextInputStyle.Short)

		const questTakerInput = new TextInputBuilder()
			.setCustomId('quest-taker-input')
			.setLabel('任务承接人（不要更改）')
			.setValue(player.dcTag)
			.setStyle(TextInputStyle.Short)

		const questExpRewardInput = new TextInputBuilder()
			.setCustomId('quest-exp-reward-input')
			.setLabel('任务经验奖励')
			.setPlaceholder('奖励经验值，必须为数字')
			.setStyle(TextInputStyle.Short)
			.setValue('0')
			.setMaxLength(2500)
			.setMinLength(1)

		// const questSilverRewardInput = new TextInputBuilder()
		// 	.setCustomId('quest-silver-reward-input')
		// 	.setLabel('任务银币奖励')
		// 	.setPlaceholder('奖励银币，必须为数字')
		// 	.setStyle(TextInputStyle.Short)
		// 	.setValue('0')
		// 	.setMaxLength(2500)
		// 	.setMinLength(1)

		modal.addComponents(
			new ActionRowBuilder<TextInputBuilder>().addComponents(questRecordIdInput),
			new ActionRowBuilder<TextInputBuilder>().addComponents(questTakerInput),
			new ActionRowBuilder<TextInputBuilder>().addComponents(questExpRewardInput)
			// new ActionRowBuilder<TextInputBuilder>().addComponents(questSilverRewardInput)
		)

		return modal
	}

	@ButtonComponent({ id: 'approve-completion' })
	async handleApproveQuestCompletionButton(interaction: ButtonInteraction) {
		const questToReview = this.questRecords[this.currentQuestIdx]

		const modal = await this.buildQuestCompletionApproveModal(questToReview)

		await interaction.showModal(modal)
	}

	@ButtonComponent({ id: 'reject-completion' })
	async handleRejectQuestCompletionButton(interaction: ButtonInteraction, client: Client) {
		const questToReview = this.questRecords[this.currentQuestIdx]

		const taker = await this.playerRepo.findOneOrFail({ id: questToReview.taker.id })

		questToReview.failDate = new Date()
		questToReview.needReview = false
		questToReview.questEnded = true

		await this.db.em.persistAndFlush(questToReview)

		client.users.fetch(taker.user.id).then((user) => {
			user.send('提交的任务已经被驳回！请联系任务部！')
		})

		this.logger.log(`<@${taker.user.id}>的任务 - ${questToReview.quest.name} - 失败了，请联系审核人<@${interaction.user.id}>`, 'info', true, yzConfig.channels.missionBroadcastChannel)

		interaction.reply({
			content: `任务【${questToReview.quest.name}】已经被驳回！`,
			ephemeral: true,
		})
	}

	@ButtonComponent({ id: 'next-review-quest' })
	async handleNextQuestButton(interaction: ButtonInteraction) {
		await interaction.deferUpdate()
		this.currentQuestIdx += 1
		const { embed, buttons } = await this.buildQuestReviewListInfoEmbed(interaction)

		interaction.editReply({
			embeds: [embed],
			components: [buttons],
		})
	}

	@ButtonComponent({ id: 'prev-review-quest' })
	async handlePrevQuestButton(interaction: ButtonInteraction) {
		await interaction.deferUpdate()
		this.currentQuestIdx -= 1
		const { embed, buttons } = await this.buildQuestReviewListInfoEmbed(interaction)

		interaction.editReply({
			embeds: [embed],
			components: [buttons],
		})
	}

	@ModalComponent({ id: 'quest-completion-approve-modal' })
	async handleQuestCompletionApproveModal(interaction: ModalSubmitInteraction, client: Client) {
		const dUser = resolveUser(interaction)
		const currentQuestRecord = this.questRecords[this.currentQuestIdx]
		const approver = await this.userRepo.findOneOrFail({ id: dUser!.id })
		const player = await this.playerRepo.findOneOrFail({ id: currentQuestRecord.taker.id })
		const quest = await this.questRepo.findOneOrFail({ id: currentQuestRecord.quest.id })

		const questName = interaction.fields.getTextInputValue('quest-name-input')
		const questExpReward = Number(interaction.fields.getTextInputValue('quest-exp-reward-input'))
		// const questSilverReward = Number(interaction.fields.getTextInputValue('quest-silver-reward-input'))

		// update quest record
		currentQuestRecord.needReview = false
		currentQuestRecord.questEnded = true
		currentQuestRecord.completeDate = new Date()
		this.db.em.persistAndFlush(currentQuestRecord)

		// updatePlayerValue(filterQuery: object, valueDelta: number, type: 'exp' | 'silver')
		if (questExpReward !== 0) {
			await this.playerRepo.updatePlayerValue({ id: player.id }, questExpReward, 'exp')
			await this.valueChangeLogRepo.insertLog(player, approver, questExpReward, 'exp', `任务奖励 - ${quest.name}`)
		}
		// if (questSilverReward !== 0) {
		// 	await this.playerRepo.updatePlayerValue({ id: player.id }, questSilverReward, 'silver')
		// 	await this.valueChangeLogRepo.insertLog(player, approver, questExpReward, 'silver', `任务奖励 - ${quest.name}`)
		// }

		let rewardMessage = `<@${player.user.id}> 提交的任务【${questName}】已经完成!`
		if (questExpReward) {
			rewardMessage += `\n获得奖励 ${questExpReward} 经验值！`
		}
		// if (questSilverReward) {
		// 	rewardMessage += `\n获得奖励 ${questSilverReward} 银币！`
		// }
		this.logger.log(rewardMessage, 'info', true, yzConfig.channels.missionBroadcastChannel)

		client.users.fetch(player.user.id).then((user) => {
			user.send(`你提交的任务【${questName}】已经审核完成，奖励已发放！`)
		})

		interaction.reply({
			content: `你刚刚批准了 <@${player.user.id}> 提交的任务 【${questName}】！`,
			ephemeral: true,
		})
	}

}
