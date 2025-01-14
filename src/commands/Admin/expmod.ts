import { Category } from '@discordx/utilities'
import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js'
import { Client } from 'discordx'

import { Discord, Injectable, Slash, SlashOption } from '@/decorators'
import { Guild, Player, User, ValueChangeLog } from '@/entities'
import { Guard, UserPermissions } from '@/guards'
import { Database } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

@Discord()
@Injectable()
@Category('Admin')
export default class ExpModCommand {

	constructor(
		private db: Database
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
			// TODO: add log
			await interaction.followUp({ content: 'Experience points modified successfully.' })
		} catch (error) {
			console.error('Error modifying experience points:', error) // TODO: use logger
			await interaction.followUp({ content: 'An error occurred while modifying experience points. Please try again later.' })
		}
	}

}
