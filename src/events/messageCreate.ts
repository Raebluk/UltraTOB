import { ArgsOf, Client } from 'discordx'

import { Discord, Guard, Injectable, On } from '@/decorators'
import { DailyCounter, Player } from '@/entities'
import { Maintenance } from '@/guards'
import { Database } from '@/services'

@Discord()
@Injectable()
export default class MessageCreateEvent {

	constructor(
		private db: Database
	) {}

	@On('messageCreate')
	@Guard(
		Maintenance
	)
	async messageCreateHandler(
		[message]: ArgsOf<'messageCreate'>,
		client: Client
	) {
		if (message.author.bot) return

		const playerRepo = this.db.get(Player)
		const dailyCounterRepo = this.db.get(DailyCounter)
		const playerId = `${message.member?.id}-${message.guild?.id}`
		const player = await playerRepo.findOneOrFail({ id: playerId })

		// player not found means this is a private message not message in any guild
		if (!player) return

		// update player exp after count real change value from counter
		const valueChanged = await dailyCounterRepo.updateCounter(player, 10, 'chat')
		await playerRepo.updatePlayerExp({ id: player.id }, valueChanged)
		await client.executeCommand(message, false)
	}

}
