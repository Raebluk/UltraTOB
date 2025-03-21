import { Category } from '@discordx/utilities'
import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js'
import { Client } from 'discordx'

import { yzConfig } from '@/configs'
import { Discord, Injectable, Slash, SlashChoice, SlashOption } from '@/decorators'
import { Guild, Player, User, ValueChangeLog } from '@/entities'
import { Guard, UserPermissions } from '@/guards'
import { Database, Logger } from '@/services'
import { resolveGuild, resolveUser } from '@/utils/functions'

@Discord()
@Injectable()
@Category('Admin')
export default class VModCommand {

	constructor(
		private db: Database,
		private logger: Logger
	) {}

	@Slash({ name: 'vmod' })
	@Guard(
		UserPermissions(['Administrator'])
	)
	async vmod(
		@SlashOption({
			name: 'dctag',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.DCTAG',
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		@SlashOption({
			name: 'type',
			localizationSource: 'COMMANDS.EXPMOD.OPTIONS.TYPE',
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
		type: 'exp' | 'silver',
		amount: number,
		note: string,
		interaction: CommandInteraction
	) {
		const userRepo = this.db.get(User)
		const playerRepo = this.db.get(Player)
		const guildRepo = this.db.get(Guild)
		const valueChangeLogRepo = this.db.get(ValueChangeLog)

		// make sure type is either `exp` or `sliver`
		if (!['exp', 'silver'].includes(type)) {
			return interaction.reply({
				content: '编辑类型必须是 `exp` 或 `silver`',
				ephemeral: true,
			})
		}

		try {
			const guild = resolveGuild(interaction)
			const guildEntity = await guildRepo.findOneOrFail({ id: guild?.id })

			const valueUpdated = await playerRepo.updatePlayerValue({ dcTag, guild: guildEntity }, amount, type)
			if (!valueUpdated) {
				return interaction.reply({ content: `Player with tag ${dcTag} not found in guild ${guildEntity.id}. Please contact the admins.` })
			}

			const interactionUser = resolveUser(interaction)
			const admin = await userRepo.findOneOrFail({ id: interactionUser!.id })
			const player = await playerRepo.findOneOrFail({ dcTag, guild: guildEntity })

			await valueChangeLogRepo.insertLog(player!, admin!, amount, type, note)
			const infoStr = `<@${interactionUser!.id}> just changed <@${player.user.id}>'s ${type} by ${amount}`
			this.logger.log(infoStr, 'info', true, yzConfig.channels.modLogChannel)

			return interaction.reply({ content: infoStr })
		} catch (error) {
			return interaction.reply({ content: 'An error occurred while modifying exp points. Talk to the Allmighty Kulbear.' })
		}
	}

}
