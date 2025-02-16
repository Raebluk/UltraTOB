import { ArgsOf, Client } from 'discordx'

import { generalConfig, playerConfig } from '@/configs'
import { Discord, Injectable, On, Schedule } from '@/decorators'
import {
	DailyCounter,
	DailyCounterRepository,
	Player,
	PlayerRepository,
	User,
	UserRepository,
	ValueChangeLog,
	ValueChangeLogRepository,
} from '@/entities'
import { Database, Logger } from '@/services'
import { resolveDependency, syncGuild, syncUser } from '@/utils/functions'

@Discord()
@Injectable()
export default class GuildAvailableEvent {

	private dailyCounterRepo: DailyCounterRepository
	private playerRepo: PlayerRepository
	private userRepo: UserRepository
	private valueChangeLogRepo: ValueChangeLogRepository

	constructor(
		private logger: Logger,
		private db: Database
	) {
		this.dailyCounterRepo = this.db.get(DailyCounter)
		this.playerRepo = this.db.get(Player)
		this.valueChangeLogRepo = this.db.get(ValueChangeLog)
		this.userRepo = this.db.get(User)
	}

	@On('guildAvailable')
	async guildAvailableHandler(
		[guild]: ArgsOf<'guildAvailable'>,
		client: Client
	) {
		syncGuild(guild.id, client)

		const members = await guild.members.fetch()
		for (const member of members.values()) {
			const existingPlayer = await this.playerRepo.findOne({ id: `${member.user.id}-${guild.id}` })
			if (!existingPlayer) {
				await syncUser(member.user)
				const player = await this.playerRepo.addPlayer(member.user, guild).catch()
				await this.dailyCounterRepo.initCounter(player)
			} else {
				// check whether there is a counter for the player
				const counter = await this.dailyCounterRepo.findOne({ player: existingPlayer })
				if (!counter) {
					this.logger.log('Not found daily counter for the player, initializing...', 'info')
					await this.dailyCounterRepo.initCounter(existingPlayer)
				}
			}
			// TODO: check if the player has left the guild
			// TODO: check if the player has update tag or other related info
		}
	}

	@Schedule('55 23 * * *') // everyday at 23:55
	async resetAllDailyCounters() {
		// Use bot as the moderator, provided id is bot id
		const moderator = await this.userRepo.findOneOrFail({ id: generalConfig.botId })

		// Fetch all daily counters
		const counters = await this.dailyCounterRepo.findAll()

		const currentDate = new Date().toISOString().split('T')[0]
		// Iterate through each counter and reset them while logging the value change
		for (const counter of counters) {
			const playerId = counter.player.id
			const player = await this.playerRepo.findOneOrFail({ id: playerId })
			const playerExpDailyLimit = player.exp > playerConfig.expDoubleLimit ? 200 : 100
			const valueChanged = playerExpDailyLimit - (counter.chatExp + counter.voiceExp)
			// Log the experience change
			await this.valueChangeLogRepo.insertLog(player, moderator, valueChanged, 'exp', `Daily Reset by TOB | ${currentDate}`)
		}

		// Reset all daily counters
		await this.dailyCounterRepo.resetAllCounters()

		// Log the reset action
		this.logger.log('All daily counters have been reset.', 'info')
	}

	// every 5 minutes
	@Schedule('0 */5 * * *') // every 5 minutes
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
