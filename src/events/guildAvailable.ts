import { ArgsOf, Client } from 'discordx'

import { generalConfig, playerConfig } from '@/configs'
import { Discord, Injectable, On, Schedule } from '@/decorators'
import { DailyCounter, Player, User, ValueChangeLog } from '@/entities'
import { Database, Logger } from '@/services'
import { resolveDependency, syncGuild, syncUser } from '@/utils/functions'

@Discord()
@Injectable()
export default class GuildAvailableEvent {

	constructor(
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

	@Schedule('55 23 * * *') // everyday at 23:55
	async resetAllDailyCounters() {
		const dailyCounterRepo = this.db.get(DailyCounter)
		const valueChangeLogRepo = this.db.get(ValueChangeLog)
		const userRepo = this.db.get(User)
		const playerRepo = this.db.get(Player)

		// Use bot as the moderator, provided id is bot id
		const moderator = await userRepo.findOneOrFail({ id: generalConfig.botId })

		// Fetch all daily counters
		const counters = await dailyCounterRepo.findAll()

		const currentDate = new Date().toISOString().split('T')[0]
		// Iterate through each counter and reset them while logging the value change
		for (const counter of counters) {
			const playerId = counter.player.id
			const player = await playerRepo.findOneOrFail({ id: playerId })
			const playerExpDailyLimit = player.exp > playerConfig.expDoubleLimit ? 200 : 100
			const valueChanged = playerExpDailyLimit - (counter.chatExp + counter.voiceExp)
			// Log the experience change
			await valueChangeLogRepo.insertLog(player, moderator, valueChanged, 'exp', `Daily Reset by TOB | ${currentDate}`)
		}

		// Reset all daily counters
		await dailyCounterRepo.resetAllCounters()

		// Log the reset action
		this.logger.log('All daily counters have been reset.', 'info')
	}

	// every 5 minutes
	@Schedule('*/5 * * * *') // every 5 minutes
	async scanVoiceChannel() {
		const client = await resolveDependency(Client)

		const playerRepo = this.db.get(Player)
		const dailyCounterRepo = this.db.get(DailyCounter)
		// Fetch all guilds from client
		const guilds = client.guilds.cache

		for (const guild of guilds.values()) {
			const channels = await guild.channels.fetch()
			// Filter out only voice-based channels
			const voiceChannels = channels.filter(channel => channel?.isVoiceBased())
			for (const channel of voiceChannels.values()) {
				for (const member of channel!.members) {
					const player = await playerRepo.findOne({ id: `${member[1].id}-${guild.id}` })
					if (player) {
						const valueChanged = await dailyCounterRepo.updateCounter(player, 1, 'voice')
						await playerRepo.updatePlayerValue({ id: player.id }, valueChanged, 'exp')
					}
				}
			}
		}
	}

}
