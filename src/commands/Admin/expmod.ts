import { Category } from '@discordx/utilities'
import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js'
import { Client } from 'discordx'

import { Discord, Injectable, Slash, SlashOption } from '@/decorators'
import { Guild, Player, User, ValueChangeLog } from '@/entities'
import { Guard, UserPermissions } from '@/guards'
import { Database, Logger } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

@Discord()
@Injectable()
@Category('Admin')
export default class ExpModCommand {

	constructor(
		private db: Database,
		private logger: Logger
	) {}

	@Slash({ name: 'expmod' })
	@Guard(
		UserPermissions(['Administrator'])
	)
	async expmod(
		@SlashOption({
			name: 'dctag',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.DCTAG',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		@SlashOption({
			name: 'amount',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.AMOUNT',
			type: ApplicationCommandOptionType.Number,
			required: true,
		})
		@SlashOption({
			name: 'note',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.NOTE',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		dcTag: string,
		amount: number,
		note: string,
		interaction: CommandInteraction, // to get caller
		client: Client,
		{ localize }: InteractionData
	) {
		const userRepo = this.db.get(User)
		const playerRepo = this.db.get(Player)
		const guildRepo = this.db.get(Guild)
		const valueChangeLogRepo = this.db.get(ValueChangeLog)

		try {
			const guild = resolveGuild(interaction)
			const guildEntity = await guildRepo.findOneOrFail({ id: guild?.id })

			const expUpdated = await playerRepo.updatePlayerExp({ dcTag, guild: guildEntity }, amount)
			if (!expUpdated) {
				return interaction.followUp({ content: `Player with tag ${dcTag} not found in guild ${guildEntity.id}. Please contact the admins.` })
			}

			const interactionUser = resolveUser(interaction)
			const admin = await userRepo.findOneOrFail({ id: interactionUser!.id })
			const player = await playerRepo.findOneOrFail({ dcTag, guild: guildEntity })

			await valueChangeLogRepo.insertLog(player!, admin!, amount, 'exp', note)
			const infoStr = `${interactionUser?.username} just changed ${player.dcTag}'s exp by ${amount}`
			this.logger.log(infoStr, 'info', true, null) // TODO: log to channel if required.
			await interaction.followUp({ content: infoStr })
		} catch (error) {
			await interaction.followUp({ content: 'An error occurred while modifying exp points. Talk to the Allmighty Kulbear.' })
		}
	}

}
