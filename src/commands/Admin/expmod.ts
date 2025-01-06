import { Category } from '@discordx/utilities'
import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js'
import { Client } from 'discordx'

import { Discord, Injectable, Slash, SlashOption } from '@/decorators'
import { Guild, Player } from '@/entities'
import { Guard, UserPermissions } from '@/guards'
import { Database } from '@/services'
import { resolveGuild, simpleSuccessEmbed } from '@/utils/functions'

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
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.DCTAG', // TODO: change
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		@SlashOption({
			name: 'amount',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.AMOUNT', // TODO: change
			type: ApplicationCommandOptionType.Number,
			required: true,
		})
		dcTag: string,
		amount: number,
		interaction: CommandInteraction, // to get caller
		client: Client,
		{ localize }: InteractionData
	) {
		const guild = resolveGuild(interaction)
		const guildEntity = await this.db.get(Guild).findOneOrFail({ id: guild?.id })
		if (!guildEntity)
			interaction.followUp({ content: 'Guild not found... Check database...' })

		const expUpdated = await this.db.get(Player).updatePlayerExp({ dcTag, guild: guildEntity }, amount)
		if (!expUpdated)
			interaction.followUp({ content: 'Player not found...Contact admins...' })
		else
			interaction.followUp({ content: 'Modified Exp...' })
	}

}
