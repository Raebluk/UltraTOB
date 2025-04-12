import { Category } from '@discordx/utilities'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
	ActionRowBuilder,
	CommandInteraction,
	ModalBuilder,
	ModalSubmitInteraction,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js'
import { ModalComponent } from 'discordx'

import { Discord, Injectable, Slash, SlashGroup } from '@/decorators'
import {
	Guild,
	GuildRepository,
	Player,
	PlayerRepository,
	Quest,
	QuestRepository,
	User,
} from '@/entities'
import { Guard, UserPermissions } from '@/guards'
import { Database } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

dayjs.extend(relativeTime)

@Discord()
@Injectable()
@Category('General')
@SlashGroup({
	name: 'quest',
})
export default class QuestPublishCommand {

	private playerRepo: PlayerRepository
	private guildRepo: GuildRepository
	private questRepo: QuestRepository

	constructor(
		private db: Database
	) {
		this.playerRepo = this.db.get(Player)
		this.guildRepo = this.db.get(Guild)
		this.questRepo = this.db.get(Quest)
	}

	@Slash({
		name: 'publish',
		description: '发布任务（需要管理员审核）',
	})
	@SlashGroup('quest')
	@Guard(
		UserPermissions(['Administrator'])
	)
	async publish(interaction: CommandInteraction) {
		const modal = this.buildQuestPublishModal()
		console.log('Publish cmd triggered!')
		await interaction.showModal(modal)
	}

	private buildQuestPublishModal(): ModalBuilder {
		const modal = new ModalBuilder()
			.setCustomId('publish-quest-modal')
			.setTitle('发布新任务')

		const questDescriptionInput = new TextInputBuilder()
			.setCustomId('quest-description-input')
			.setLabel('要发布的任务是关于...')
			.setPlaceholder('任务名称（任务名称，然后回车输入描述）\n任务描述（换行后开始输入任务描述）')
			.setStyle(TextInputStyle.Paragraph)
			.setMaxLength(2500)
			.setMinLength(2)

		const questDurationInput = new TextInputBuilder()
			.setCustomId('quest-duration-input')
			.setLabel('任务截止时间是...')
			.setPlaceholder('格式示例: 1w2d4h30m, 1d12h, 10d, 3h30m...')
			.setStyle(TextInputStyle.Short)

		const questRewardInput = new TextInputBuilder()
			.setCustomId('quest-reward-input')
			.setLabel('任务奖励是...')
			.setPlaceholder('奖励描述...')
			.setStyle(TextInputStyle.Short)
			.setMaxLength(2500)
			.setMinLength(2)

		const questMultipleTakerInput = new TextInputBuilder()
			.setCustomId('quest-multiple-taker-input')
			.setLabel('任务是否可被多人接取')
			.setPlaceholder('1 for yes, 0 for no')
			.setStyle(TextInputStyle.Short)
			.setMaxLength(10)
			.setMinLength(1)

		const questRepeatableInput = new TextInputBuilder()
			.setCustomId('quest-repeatable-input')
			.setLabel('任务是否可单人重复接取')
			.setPlaceholder('1 for yes, 0 for no')
			.setStyle(TextInputStyle.Short)
			.setMaxLength(10)
			.setMinLength(1)

		const questManualInput = new TextInputBuilder()
			.setCustomId('quest-manual-input')
			.setLabel('任务是否需要手动接取')
			.setPlaceholder('1 for yes, 0 for no')
			.setStyle(TextInputStyle.Short)
			.setMaxLength(10)

		modal.addComponents(
			new ActionRowBuilder<TextInputBuilder>().addComponents(questDescriptionInput),
			new ActionRowBuilder<TextInputBuilder>().addComponents(questDurationInput),
			new ActionRowBuilder<TextInputBuilder>().addComponents(questRewardInput),
			new ActionRowBuilder<TextInputBuilder>().addComponents(questMultipleTakerInput),
			new ActionRowBuilder<TextInputBuilder>().addComponents(questRepeatableInput),
			new ActionRowBuilder<TextInputBuilder>().addComponents(questManualInput)
		)

		return modal
	}

	@ModalComponent({ id: 'publish-quest-modal' })
	async handleQuestPublishModal(interaction: ModalSubmitInteraction) {
		const questNameDescription = interaction.fields.getTextInputValue('quest-description-input')
		const questDuration = interaction.fields.getTextInputValue('quest-duration-input')
		const questReward = interaction.fields.getTextInputValue('quest-reward-input')
		const questMultipleTaker = interaction.fields.getTextInputValue('quest-multiple-taker-input')
		const questRepeatable = interaction.fields.getTextInputValue('quest-repeatable-input')
		const questManual = interaction.fields.getTextInputValue('quest-manual-input')

		const questNameDescriptionArray = questNameDescription.split('\n')
		const questName = questNameDescriptionArray[0]
		const questDescription = questNameDescriptionArray.slice(1).join('\n')

		const dGuild = await resolveGuild(interaction)
		const dUser = await resolveUser(interaction)

		const guild = await this.guildRepo.findOneOrFail({ id: dGuild!.id })
		const player = await this.playerRepo.findOneOrFail({ id: `${dUser!.id}-${dGuild!.id}` })

		await this.questRepo.insertQuestAdmin(
			player,
			guild,
			questName,
			questDescription,
			questReward,
			questMultipleTaker,
			questRepeatable,
			questDuration,
			questManual
		)

		interaction.reply({
			content: `任务 - ${questName} 已经发布成功！`,
			ephemeral: true,
		})
	}

}
