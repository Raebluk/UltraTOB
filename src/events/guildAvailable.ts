import { Guild as DGuild } from 'discord.js'
import { ArgsOf, Client } from 'discordx'

import { Discord, Injectable, On, Schedule } from '@/decorators'
import { DailyCounter, Player } from '@/entities'
import { Database, Logger, Stats } from '@/services'
import { syncGuild, syncUser } from '@/utils/functions'

@Discord()
@Injectable()
export default class GuildAvailableEvent {

	private currentGuild: DGuild

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
		this.currentGuild = guild
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

	// every 5 second
	@Schedule('0 */5 * * * *')
	async scanVoiceChannel() {
		// find all voice channels in current guild
		const playerRepo = this.db.get(Player)
		const dailyCounterRepo = this.db.get(DailyCounter)
		// console.log(this.currentGuild.channels)
		const channels = await this.currentGuild.channels.fetch()
		const voiceChannels = channels.filter(channel => channel?.isVoiceBased())
		for (const channel of voiceChannels.values()) {
			for (const member of channel!.members) {
				const player = await playerRepo.findOne({ id: `${member[1].id}-${this.currentGuild.id}` })
				if (player) {
					// update player exp after count real change value from counter
					const valueChanged = await dailyCounterRepo.updateCounter(player, 1, 'voice')
					await playerRepo.updatePlayerExp({ id: player.id }, valueChanged)
				}
			}
		}
	}

}
