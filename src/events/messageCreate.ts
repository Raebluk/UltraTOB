import { ArgsOf, Client } from 'discordx'

import { Discord, Guard, Injectable, On } from '@/decorators'
import {
	DailyCounter,
	DailyCounterRepository,
	Player,
	PlayerRepository,
} from '@/entities'
import { Maintenance } from '@/guards'
import { Database } from '@/services'

@Discord()
@Injectable()
export default class MessageCreateEvent {

	private playerRepo: PlayerRepository
	private dailyCounterRepo: DailyCounterRepository

	constructor(
		private db: Database
	) {
		this.playerRepo = this.db.get(Player)
		this.dailyCounterRepo = this.db.get(DailyCounter)
	}

	@On('messageCreate')
	@Guard(
		Maintenance
	)
	async messageCreateHandler(
		[message]: ArgsOf<'messageCreate'>,
		client: Client
	) {
		if (message.author.bot) return
		// accumulate exp for text message
		this.onMessageCreateAccumulateDailyTextExp(message)

		await client.executeCommand(message, false)
	}

	async onMessageCreateAccumulateDailyTextExp(message: any) {
		const playerId = `${message.member?.id}-${message.guild?.id}`
		const player = await this.playerRepo.findOne({
			id: playerId,
		})

		if (!player) return

		const valueChanged = await this.dailyCounterRepo.updateCounter(player, 10, 'chat')
		await this.playerRepo.updatePlayerValue({ id: player.id }, valueChanged, 'exp')
	}

}
