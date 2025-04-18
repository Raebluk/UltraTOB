import { ArgsOf, Client } from 'discordx'

import { Discord, Injectable, On, Schedule } from '@/decorators'
import {
	DailyCounter,
	DailyCounterRepository,
	Guild,
	GuildConfigItem,
	GuildConfigItemRepository,
	GuildRepository,
	Player,
	PlayerRepository,
	User,
	UserRepository,
	ValueChangeLog,
	ValueChangeLogRepository,
} from '@/entities'
import { env } from '@/env'
import { Database, Logger } from '@/services'
import { resolveDependency, syncGuild, syncUser } from '@/utils/functions'

@Discord()
@Injectable()
export default class GuildAvailableEvent {

	private dailyCounterRepo: DailyCounterRepository
	private playerRepo: PlayerRepository
	private userRepo: UserRepository
	private valueChangeLogRepo: ValueChangeLogRepository
	private guildRepo: GuildRepository
	private configRepo: GuildConfigItemRepository
	private expConfig: Record<string, number> = {}

	constructor(
		private logger: Logger,
		private db: Database
	) {
		this.dailyCounterRepo = this.db.get(DailyCounter)
		this.playerRepo = this.db.get(Player)
		this.valueChangeLogRepo = this.db.get(ValueChangeLog)
		this.userRepo = this.db.get(User)
		this.guildRepo = this.db.get(Guild)
		this.configRepo = this.db.get(GuildConfigItem)
	}

	@On('guildAvailable')
	async guildAvailableHandler(
		[guild]: ArgsOf<'guildAvailable'>,
		client: Client
	) {
		syncGuild(guild.id, client)

		const guildEntity = await this.guildRepo.findOneOrFail({ id: guild.id })
		const expDoubleLimitConfig = await this.configRepo.get('expDoubleLimit', guildEntity)
		this.expConfig[guild.id] = expDoubleLimitConfig !== null ? JSON.parse(expDoubleLimitConfig!.value) : 4845

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
		const moderator = await this.userRepo.findOneOrFail({ id: env.BOT_ID })
		// Fetch all daily counters
		const counters = await this.dailyCounterRepo.findAll()

		const currentDate = new Date().toISOString().split('T')[0]
		// Iterate through each counter and reset them while logging the value change
		for (const counter of counters) {
			const playerId = counter.player.id
			const player = await this.playerRepo.findOneOrFail({ id: playerId })
			const playerExpDailyLimit = player.exp > this.expConfig[player.guild.id] ? 200 : 100
			const valueChanged = playerExpDailyLimit - (counter.chatExp + counter.voiceExp)
			// Log the experience change
			if (valueChanged > 0) await this.valueChangeLogRepo.insertLog(player, moderator, valueChanged, 'exp', `Daily Reset by TOB | ${currentDate}`)
		}

		// Find all guilds in the database
		const guilds = await this.guildRepo.findAll()
		for (const guild of guilds) {
			// Reset all daily counters
			await this.dailyCounterRepo.resetAllCountersByGuild(guild)
		}

		// // Reset all daily counters
		// await this.dailyCounterRepo.resetAllCounters()

		// Log the reset action
		this.logger.log('All daily counters have been reset.', 'info')
	}

	// @Schedule('*/5 * * * * *') // every 5 seconds (for testing purposes)
	@Schedule('*/5 * * * *') // every 5 minutes
	async scanVoiceChannel() {
		this.logger.log('Scanned voice channels')
		const client = await resolveDependency(Client)
		await this.playerRepo.getEntityManager().flush()
		await this.dailyCounterRepo.getEntityManager().flush()
		// Fetch all guilds from client
		const guilds = client.guilds.cache

		for (const guild of guilds.values()) {
			const channels = await guild.channels.fetch()
			// Filter out only voice-based channels
			const voiceChannels = channels.filter(channel => channel?.isVoiceBased())
			for (const channel of voiceChannels.values()) {
				for (const member of channel!.members) {
					const player = await this.playerRepo.findOne(
						{ id: `${member[1].id}-${guild.id}` },
						{ cache: false, refresh: true }
					)
					if (player) {
						this.logger.log(`Player <@${player.dcTag}> in channel ${channel!.name} in guild ${guild.name}`, 'info')
						const valueChanged = await this.dailyCounterRepo.updateCounter(player, player.exp >= this.expConfig[guild.id] ? 2 : 1, 'voice')
						const updateStatus = await this.playerRepo.updatePlayerValue({ id: player.id }, valueChanged, 'exp')
						if (updateStatus) {
							this.logger.log(`Player <@${player.dcTag}> has gained ${valueChanged} exp from voice channel in guild ${guild.name}. Player current exp: ${player.exp}`, 'info')
						} else {
							this.logger.log(`Failed to update player exp <@${player.dcTag}> in guild ${guild.name}. Player current exp ${player.exp}`, 'error')
						}
					}
				}
			}
		}
	}

}
