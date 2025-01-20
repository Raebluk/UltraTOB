import { ArgsOf, Client } from 'discordx'

import { Discord, Injectable, On, Schedule } from '@/decorators'
import { DailyCounter, Player } from '@/entities'
import { Database, Logger, Stats } from '@/services'
import { syncGuild, syncUser } from '@/utils/functions'

@Discord()
@Injectable()
export default class GuildAvailableEvent {

	constructor(
		private stats: Stats,
		private logger: Logger,
		private db: Database
	) {}

	@On('guildAvailable')
	async guildAvailableHandler(
		[guild]: ArgsOf<'guildAvailable'>,
		client: Client
	) {
		syncGuild(guild.id, client)

		const members = await guild.members.fetch()
		for (const member of members.values()) {
			const existingPlayer = await this.db.get(Player).findOne({ id: `${member.user.id}-${guild.id}` })
			if (!existingPlayer) {
				await syncUser(member.user)
				this.db.get(Player).addPlayer(member.user, guild).catch()
			}
			// TODO: check if the player has left the guild
			// TODO: check if the player has update tag or other related info
		}
	}

	@Schedule('55 23 * * *') // every day @ 23:55 PM
	async resetAllDailyCounters() {
		this.db.get(DailyCounter).resetAllCounters()
		this.logger.log('All daily counters have been reset.', 'info')
	}

}
