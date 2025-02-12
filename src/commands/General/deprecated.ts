import { CommandInteraction } from 'discord.js'

import { Discord, Injectable, Slash, SlashGroup } from '@/decorators'

@Discord()
@SlashGroup({
	name: 'quest',
})
export default class DeprecatedCommand {

	@Slash({ name: 'expmod' })
	async expmod(interaction: CommandInteraction) {
		return interaction.reply({
			content: '该命令已弃用，请使用/vmod',
			ephemeral: true,
		})
	}

}
