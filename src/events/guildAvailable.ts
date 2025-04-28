import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

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
import { resolveDependency, syncGuild, syncUser, updatePlayerLevelRoles } from '@/utils/functions'

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
		}
	}

	@Schedule('45 23 * * *') // everyday at 23:45
	async resetAllDailyCounters() {
		// Use bot as the moderator, provided id is bot id
		const moderator = await this.userRepo.findOneOrFail({ id: env.BOT_ID })
		// Fetch all daily counters
		const counters = await this.dailyCounterRepo.findAll()

		const currentDate = new Date().toISOString().split('T')[0]
		// Iterate through each counter and log the value change
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
			const guildEntity = await this.guildRepo.findOneOrFail({ id: guild.id })
			// send message to guild specific mod-log channel, the channel is defined in the guild config
			const adminLogChannelConfig = await this.configRepo.get('adminLogChannel', guildEntity)
			const adminLogChannel = adminLogChannelConfig !== null
				? (JSON.parse(adminLogChannelConfig.value) as string[])
				: []
			adminLogChannel.forEach((channelId: string) => {
				this.logger.log(`All daily counters have been reset for this guild.`, 'info', true, channelId)
			})
		}

		// Log the reset action
		this.logger.log('All daily counters have been reset.', 'info')
	}

	// @Schedule('*/2 * * * *') // Every 2 minutes (TESTING)
	@Schedule('55 23 * * 0') // Every Sunday at 23:55 (PRODUCTION)
	async checkWeeklyActivity() {
		// FOR TESTING:
		// 1. Set TEST_MODE = true (no actual EXP deduction)
		// 2. Use frequent schedule like '*/2 * * * *' (every 2 minutes)
		// 3. Monitor logs and mod channels for results
		//
		// FOR PRODUCTION:
		// 1. Set TEST_MODE = false
		// 2. Use production schedule '55 23 * * 0' (Sunday 23:55)
		// 3. Comment out test schedule, uncomment production schedule

		// ==========================================
		// ========= CONFIGURATION VARIABLES =======
		// ==========================================

		// Testing and Environment - now loaded from guild config
		const DEFAULT_TEST_MODE = false // Default fallback value

		// Activity Thresholds
		const WEEKLY_ACTIVITY_THRESHOLD = 80 // Minimum EXP required per week to avoid penalty
		const LOW_EXP_THRESHOLD = 200 // Players below this EXP get reset to 0 instead of deduction
		const STANDARD_PENALTY_AMOUNT = 200 // EXP deducted from high EXP players

		// Time Periods (in days)
		const ACTIVITY_CHECK_PERIOD = 7 // Days to check for activity
		const GRACE_PERIOD = 6 // Days grace period for new members

		// Processing Configuration
		const BATCH_SIZE = 100 // Players processed per batch
		const BATCH_DELAY = 100 // Milliseconds delay between batches

		// Display Configuration
		const MAX_PLAYERS_TO_SHOW = 15 // Maximum players shown in embed lists

		// Embed Colors
		const COLOR_TEST_MODE = 0xFFA500 // Orange for test mode
		const COLOR_PENALTIES_APPLIED = 0xFF6B6B // Red when penalties are applied
		const COLOR_ALL_ACTIVE = 0x00FF00 // Green when all players are active

		// ==========================================
		// ========= END CONFIGURATION =============
		// ==========================================

		const currentDate = new Date().toISOString().split('T')[0]
		const activityCheckDate = new Date()
		activityCheckDate.setDate(activityCheckDate.getDate() - ACTIVITY_CHECK_PERIOD)

		// Call the refactored method with weekly activity parameters
		// Grace period is now calculated automatically from the start date
		await this.checkDateRangeActivity({
			startDate: activityCheckDate,
			endDate: new Date(),
			reportDate: currentDate,
			activityThreshold: WEEKLY_ACTIVITY_THRESHOLD,
			lowExpThreshold: LOW_EXP_THRESHOLD,
			standardPenaltyAmount: STANDARD_PENALTY_AMOUNT,
			activityCheckPeriod: ACTIVITY_CHECK_PERIOD,
			gracePeriod: GRACE_PERIOD,
			batchSize: BATCH_SIZE,
			batchDelay: BATCH_DELAY,
			maxPlayersToShow: MAX_PLAYERS_TO_SHOW,
			colorTestMode: COLOR_TEST_MODE,
			colorPenaltiesApplied: COLOR_PENALTIES_APPLIED,
			colorAllActive: COLOR_ALL_ACTIVE,
			testMode: DEFAULT_TEST_MODE, // Will be overridden per guild
			skipGuildInTestMode: '1201994394761433139',
			reportType: 'WEEKLY ACTIVITY CHECK',
			enableTestInflation: true,
		})
	}

	/**
	 * Generic method to check player activity within any date range and apply penalties
	 * @param config Configuration object containing all parameters for the activity check
	 */
	async checkDateRangeActivity(config: {
		startDate: Date
		endDate: Date
		reportDate: string
		activityThreshold: number
		lowExpThreshold: number
		standardPenaltyAmount: number
		activityCheckPeriod: number
		gracePeriod: number
		batchSize: number
		batchDelay: number
		maxPlayersToShow: number
		colorTestMode: number
		colorPenaltiesApplied: number
		colorAllActive: number
		testMode: boolean
		skipGuildInTestMode?: string
		reportType: string
		enableTestInflation?: boolean
	}) {
		// Calculate grace period cutoff based on the START DATE of the activity period
		// This ensures users who joined after (startDate - gracePeriod) are excluded
		const gracePeriodCutoffDate = new Date(config.startDate)
		gracePeriodCutoffDate.setDate(gracePeriodCutoffDate.getDate() - config.gracePeriod)

		this.logger.log(`📅 Activity period: ${config.startDate.toISOString().split('T')[0]} to ${config.endDate.toISOString().split('T')[0]}`, 'info')
		this.logger.log(`⏰ Grace period cutoff: Players created before ${gracePeriodCutoffDate.toISOString().split('T')[0]} are eligible`, 'info')

		// Use bot as the moderator for the deduction
		const moderator = await this.userRepo.findOneOrFail({ id: env.BOT_ID })

		// Process by guild for better organization and mod log reporting
		const guilds = await this.guildRepo.findAll()

		for (const guild of guilds) {
			// Read test mode from guild config (default to false)
			const testModeConfig = await this.configRepo.get('botTestMode', guild)
			const guildTestMode = testModeConfig !== null ? JSON.parse(testModeConfig.value) === true : config.testMode

			// Skip specific guild in test mode if specified
			if (guildTestMode && config.skipGuildInTestMode && guild.id === config.skipGuildInTestMode) {
				this.logger.log(`🧪 TEST MODE: Skipping guild ${guild.id} as requested`, 'info')
				continue
			}

			this.logger.log(`Starting ${config.reportType.toLowerCase()} for guild ${guild.id} (Test Mode: ${guildTestMode ? 'ON' : 'OFF'})`, 'info')

			// Create comprehensive log file entry for this guild
			const guildLogHeader = `
=================================================================
${config.reportType} REPORT - ${config.reportDate}
Guild: ${guild.id}
Mode: ${guildTestMode ? 'TEST MODE (NO ACTUAL CHANGES)' : 'PRODUCTION MODE'}
Activity Period: ${config.activityCheckPeriod} days
Activity Threshold: ${config.activityThreshold} EXP/period
Grace Period: ${config.gracePeriod} days
Date Range: ${config.startDate.toISOString().split('T')[0]} to ${config.endDate.toISOString().split('T')[0]}
Grace Period Cutoff: ${gracePeriodCutoffDate.toISOString().split('T')[0]}
=================================================================`
			this.logger.file(guildLogHeader, 'info')

			// Get all players in this guild, excluding those created within grace period and those with 0 total EXP
			// Grace period is calculated from the START DATE of the activity period, not current date
			const eligiblePlayers = await this.playerRepo.find({
				guild,
				createdAt: { $lt: gracePeriodCutoffDate },
				exp: { $gt: 0 }, // Exclude players with 0 total EXP
			})

			this.logger.log(`Found ${eligiblePlayers.length} eligible players for activity check in guild ${guild.id}`, 'info')
			this.logger.file(`Found ${eligiblePlayers.length} eligible players for activity check`, 'info')

			const inactivePlayers: Array<{ player: Player, weeklyExp: number }> = []
			const activePlayers: Array<{ player: Player, weeklyExp: number }> = []

			// Batch process players to avoid memory issues with large datasets
			for (let i = 0; i < eligiblePlayers.length; i += config.batchSize) {
				const batch = eligiblePlayers.slice(i, i + config.batchSize)

				// Process each player in the current batch
				for (const player of batch) {
					// Get all exp gains for this player in the specified date range
					const periodExpLogs = await this.valueChangeLogRepo.find({
						player,
						type: 'exp',
						amount: { $gt: 0 }, // Only positive exp changes
						createdAt: { $gte: config.startDate, $lte: config.endDate },
					})

					// Calculate total period exp
					const totalPeriodExp = periodExpLogs.reduce((sum, log) => sum + log.amount, 0)

					// Log each player's activity status
					const activityStatus = totalPeriodExp >= config.activityThreshold ? 'ACTIVE' : 'INACTIVE'
					const playerLogEntry = `Player: ${player.dcTag} | UserID: ${player.user.id} | Current EXP: ${player.exp} | Period EXP: ${totalPeriodExp} | Status: ${activityStatus}`
					this.logger.file(playerLogEntry, 'info')

					// Categorize players based on period activity
					if (totalPeriodExp < config.activityThreshold) {
						inactivePlayers.push({ player, weeklyExp: totalPeriodExp })
					} else {
						activePlayers.push({ player, weeklyExp: totalPeriodExp })
					}
				}

				// Small delay between batches to prevent overwhelming the database
				if (i + config.batchSize < eligiblePlayers.length) {
					await new Promise(resolve => setTimeout(resolve, config.batchDelay))
				}
			}

			this.logger.log(`Found ${activePlayers.length} active and ${inactivePlayers.length} inactive players in guild ${guild.id}`, 'info')

			// Log summary to file
			const summaryLog = `
-----------------------------------------------------------------
ACTIVITY SUMMARY:
Active Players: ${activePlayers.length}
Inactive Players: ${inactivePlayers.length}
Total Eligible Players: ${eligiblePlayers.length}
-----------------------------------------------------------------`
			this.logger.file(summaryLog, 'info')

			// Apply penalties to inactive players with smart penalty logic
			let deductedCount = 0
			const penaltyDetails: Array<{ player: Player, weeklyExp: number, penaltyType: 'deduction' | 'reset', amount: number }> = []

			if (inactivePlayers.length > 0) {
				this.logger.file('PENALTY APPLICATION DETAILS:', 'info')
				this.logger.file('-----------------------------------------------------------------', 'info')
			}

			for (const { player, weeklyExp } of inactivePlayers) {
				try {
					const originalExp = player.exp
					let penaltyAmount: number
					let penaltyType: 'deduction' | 'reset'
					let logMessage: string

					// Smart penalty logic with safety checks to prevent negative EXP
					if (player.exp < config.lowExpThreshold) {
						// For players with less than threshold EXP, reset to 0
						penaltyAmount = -player.exp // This will set their EXP to 0
						penaltyType = 'reset'
						logMessage = `${config.reportType} Penalty - EXP reset to 0 (was ${player.exp}, period activity: ${weeklyExp}) | ${config.reportDate}`
					} else {
						// For players with threshold+ EXP, deduct standard amount but ensure EXP doesn't go negative
						const maxDeduction = Math.min(config.standardPenaltyAmount, player.exp)
						penaltyAmount = -maxDeduction
						penaltyType = 'deduction'
						logMessage = `${config.reportType} Penalty - ${maxDeduction} EXP deducted (period activity: ${weeklyExp}) | ${config.reportDate}`
					}

					penaltyDetails.push({ player, weeklyExp, penaltyType, amount: Math.abs(penaltyAmount) })

					if (guildTestMode) {
						// Test mode: just log what would happen
						const action = penaltyType === 'reset' ? `reset EXP to 0` : `deduct ${Math.abs(penaltyAmount)} exp`
						const newExp = Math.max(0, player.exp + penaltyAmount)

						this.logger.log(`🧪 TEST: Would ${action} for ${player.dcTag} (current: ${player.exp}, period: ${weeklyExp})`, 'info')

						// Simulate role update check in test mode
						const currentRoleLevel = this.calculatePlayerLevel(player.exp)
						const newRoleLevel = this.calculatePlayerLevel(newExp)
						if (currentRoleLevel !== newRoleLevel) {
							this.logger.log(`🧪 TEST: Would update roles for ${player.dcTag} (level ${currentRoleLevel} → ${newRoleLevel})`, 'info')
						} else {
							this.logger.log(`🧪 TEST: No role change needed for ${player.dcTag} (stays at level ${currentRoleLevel})`, 'info')
						}

						// Detailed file logging for test mode
						const testLogEntry = `[TEST MODE] Player: ${player.dcTag} | UserID: ${player.user.id} | Period EXP: ${weeklyExp} | Penalty Type: ${penaltyType} | Before EXP: ${originalExp} | Would be After EXP: ${newExp} | EXP Change: ${penaltyAmount} | Role Level: ${currentRoleLevel} → ${newRoleLevel}`
						this.logger.file(testLogEntry, 'info')
					} else {
						// Production mode: actually apply penalty
						const oldExp = player.exp
						await this.playerRepo.updatePlayerValue({ id: player.id }, penaltyAmount, 'exp')

						// Refresh player data to get updated EXP
						await this.playerRepo.getEntityManager().refresh(player)

						// Safety check: Ensure EXP never goes negative
						if (player.exp < 0) {
							this.logger.log(`⚠️ SAFETY CHECK: Player ${player.dcTag} had negative EXP (${player.exp}), resetting to 0`, 'warn')
							await this.playerRepo.updatePlayerValue({ id: player.id }, -player.exp, 'exp')
							await this.playerRepo.getEntityManager().refresh(player)
						}

						// Update Discord roles based on new EXP level
						await updatePlayerLevelRoles(player, this.logger)

						this.logger.log(`Updated roles for ${player.dcTag} after EXP change (${oldExp} → ${player.exp})`, 'info')

						// Detailed file logging for production mode
						const prodLogEntry = `[PRODUCTION] Player: ${player.dcTag} | UserID: ${player.user.id} | Period EXP: ${weeklyExp} | Penalty Type: ${penaltyType} | Before EXP: ${oldExp} | After EXP: ${player.exp} | EXP Reduced: ${Math.abs(penaltyAmount)}`
						this.logger.file(prodLogEntry, 'info')

						// Log the penalty in ValueChangeLog
						await this.valueChangeLogRepo.insertLog(
							player,
							moderator,
							penaltyAmount,
							'exp',
							logMessage
						)
					}

					deductedCount++
				} catch (error) {
					const errorMessage = `Failed to ${guildTestMode ? 'simulate' : 'apply'} penalty to player ${player.dcTag}: ${error}`
					this.logger.log(errorMessage, 'error')
					this.logger.file(`ERROR: ${errorMessage}`, 'error')
				}
			}

			// Send summary embed to mod log channel (always send if there are any eligible players)
			if (activePlayers.length > 0 || inactivePlayers.length > 0) {
				// In test mode, artificially inflate penalty list by 10x to test Discord embed limits
				let testPenaltyDetails = penaltyDetails
				if (guildTestMode && config.enableTestInflation && penaltyDetails.length > 0) {
					this.logger.log(`🧪 TEST MODE: Inflating penalty list from ${penaltyDetails.length} to ${penaltyDetails.length * 10} entries for embed limit testing`, 'info')
					testPenaltyDetails = []

					// Copy the original list 10 times
					for (let multiplier = 0; multiplier < 10; multiplier++) {
						for (const penalty of penaltyDetails) {
							// Create a copy with modified dcTag to distinguish duplicates
							const testPenalty = {
								...penalty,
								player: {
									...penalty.player,
									dcTag: `${penalty.player.dcTag}_test${multiplier}`,
									user: {
										...penalty.player.user,
										id: `${penalty.player.user.id}${multiplier}`, // Modify ID to avoid Discord mention conflicts
									},
								},
							}
							testPenaltyDetails.push(testPenalty)
						}
					}

					this.logger.log(`🧪 TEST MODE: Created ${testPenaltyDetails.length} test penalty entries for embed testing`, 'info')
				}

				// Create comprehensive local log file before sending to Discord
				await this.createActivityLogFile(
					guild,
					activePlayers,
					testPenaltyDetails,
					config.reportDate,
					guildTestMode,
					{
						activityThreshold: config.activityThreshold,
						standardPenaltyAmount: config.standardPenaltyAmount,
						activityCheckPeriod: config.activityCheckPeriod,
						gracePeriod: config.gracePeriod,
						reportType: config.reportType,
					}
				)

				await this.sendActivitySummary(
					guild,
					activePlayers,
					testPenaltyDetails,
					config.reportDate,
					guildTestMode,
					{
						activityThreshold: config.activityThreshold,
						standardPenaltyAmount: config.standardPenaltyAmount,
						activityCheckPeriod: config.activityCheckPeriod,
						gracePeriod: config.gracePeriod,
						maxPlayersToShow: config.maxPlayersToShow,
						colorTestMode: config.colorTestMode,
						colorPenaltiesApplied: config.colorPenaltiesApplied,
						colorAllActive: config.colorAllActive,
						reportType: config.reportType,
					}
				)
			}

			const actionText = guildTestMode ? 'Would apply penalties to' : 'Applied penalties to'
			this.logger.log(`${config.reportType} completed for guild ${guild.id}. ${actionText} ${deductedCount} inactive players.`, 'info')

			// Final summary to log file
			const finalSummary = `
-----------------------------------------------------------------
GUILD ${guild.id} ${config.reportType} COMPLETED
${actionText} ${deductedCount} inactive players
Active Players: ${activePlayers.length}
Inactive Players with Penalties: ${inactivePlayers.length}
Total Players Processed: ${eligiblePlayers.length}
Mode: ${guildTestMode ? 'TEST MODE (NO ACTUAL CHANGES)' : 'PRODUCTION MODE'}
=================================================================
`
			this.logger.file(finalSummary, 'info')
		}

		this.logger.log(`${config.reportType} completed for all guilds.`, 'info')
	}

	private async sendActivitySummary(
		guild: Guild,
		activePlayers: Array<{ player: Player, weeklyExp: number }>,
		penaltyDetails: Array<{ player: Player, weeklyExp: number, penaltyType: 'deduction' | 'reset', amount: number }>,
		date: string,
		testMode: boolean = false,
		config: {
			activityThreshold: number
			standardPenaltyAmount: number
			activityCheckPeriod: number
			gracePeriod: number
			maxPlayersToShow: number
			colorTestMode: number
			colorPenaltiesApplied: number
			colorAllActive: number
			reportType: string
		}
	) {
		const guildEntity = await this.guildRepo.findOneOrFail({ id: guild.id })
		const adminLogChannelConfig = await this.configRepo.get('adminLogChannel', guildEntity)
		const adminLogChannels = adminLogChannelConfig !== null
			? (JSON.parse(adminLogChannelConfig.value) as string[])
			: []

		if (adminLogChannels.length === 0) {
			this.logger.log(`No admin log channels configured for guild ${guild.id}`, 'warn')

			return
		}

		// Create summary embed
		const totalPlayers = activePlayers.length + penaltyDetails.length
		const deductionCount = penaltyDetails.filter(p => p.penaltyType === 'deduction').length
		const resetCount = penaltyDetails.filter(p => p.penaltyType === 'reset').length

		const embed = {
			title: `${testMode ? '🧪 TEST MODE - ' : ''}📊 ${config.reportType} Report`,
			description: `Activity summary for **${totalPlayers}** eligible players (excludes new members <${config.gracePeriod} days & 0 EXP players).`,
			color: testMode ? config.colorTestMode : (penaltyDetails.length > 0 ? config.colorPenaltiesApplied : config.colorAllActive),
			fields: [
				{
					name: '✅ Active Players',
					value: `**${activePlayers.length}** players met the activity requirement (≥${config.activityThreshold} EXP)`,
					inline: true,
				},
				{
					name: '❌ Inactive Players',
					value: `**${penaltyDetails.length}** players ${testMode ? 'would be' : 'were'} penalized (<${config.activityThreshold} EXP period)`,
					inline: true,
				},
				{
					name: '⚖️ Penalties Applied',
					value: penaltyDetails.length > 0
						? `${deductionCount} players: ${config.standardPenaltyAmount} EXP ${testMode ? 'would be deducted' : 'deducted'}\n${resetCount} players: EXP ${testMode ? 'would be reset' : 'reset'} to 0`
						: 'No penalties needed - all players are active! 🎉',
					inline: true,
				},
				{
					name: '📅 Period Checked',
					value: `Past ${config.activityCheckPeriod} days (until ${date})`,
					inline: true,
				},
				{
					name: '🎯 Activity Threshold',
					value: `Minimum ${config.activityThreshold} EXP per period required`,
					inline: true,
				},
				{
					name: '📊 Activity Rate',
					value: `${Math.round((activePlayers.length / totalPlayers) * 100)}% of players are active`,
					inline: true,
				},
			],
			timestamp: new Date().toISOString(),
			footer: {
				text: `${testMode ? '🧪 TEST MODE • ' : ''}TOB Activity Monitor • ${penaltyDetails.length} players penalized`,
			},
		}

		// Add player details (limited to avoid embed size limits)

		// Add active players list (sorted by period exp descending)
		if (activePlayers.length > 0) {
			const activePlayersList = activePlayers
				.sort((a, b) => b.weeklyExp - a.weeklyExp) // Sort by period exp, highest first
				.slice(0, config.maxPlayersToShow)
				.map(({ player, weeklyExp }) => `<@${player.user.id}> (${weeklyExp} exp)`)
				.join('\n')

			embed.fields.push({
				name: `✅ Most Active Players ${activePlayers.length > config.maxPlayersToShow ? `(top ${config.maxPlayersToShow})` : ''}`,
				value: activePlayersList || 'None',
				inline: false,
			})
		}

		// Add penalized players list (show ALL penalized players)
		if (penaltyDetails.length > 0) {
			// Sort penalized players by penalty amount (highest first), then by weekly exp (lowest first)
			const sortedPenaltyDetails = penaltyDetails.sort((a, b) => {
				if (a.amount !== b.amount) {
					return b.amount - a.amount // Higher penalty amount first
				}

				return a.weeklyExp - b.weeklyExp // Lower weekly exp first (more inactive)
			})

			const penalizedPlayersList = sortedPenaltyDetails
				.map(({ player, weeklyExp, penaltyType, amount }) => {
					const penaltyText = penaltyType === 'reset' ? `reset to 0` : `${amount} deducted`

					return `<@${player.user.id}> (${weeklyExp} exp weekly, ${penaltyText})`
				})
				.join('\n')

			// Check if the list is too long for a single embed field (Discord limit is 1024 characters per field)
			if (penalizedPlayersList.length <= 50) {
				// Single field can handle all players
				embed.fields.push({
					name: `❌ All Penalized Players (${penaltyDetails.length} total)`,
					value: penalizedPlayersList,
					inline: false,
				})
			} else {
				// Split into multiple fields if too long
				const maxFieldLength = 1000 // Leave some buffer
				const playerEntries = sortedPenaltyDetails.map(({ player, weeklyExp, penaltyType, amount }) => {
					const penaltyText = penaltyType === 'reset' ? `reset to 0` : `${amount} deducted`

					return `<@${player.user.id}> (${weeklyExp} exp weekly, ${penaltyText})`
				})

				let currentField = ''
				let fieldIndex = 1

				for (const entry of playerEntries) {
					const newLength = currentField.length + entry.length + 1 // +1 for newline

					if (newLength > maxFieldLength && currentField.length > 0) {
						// Add current field and start a new one
						embed.fields.push({
							name: fieldIndex === 1 ? `❌ All Penalized Players (${penaltyDetails.length} total) - Part ${fieldIndex}` : `❌ Penalized Players - Part ${fieldIndex}`,
							value: currentField,
							inline: false,
						})
						currentField = entry
						fieldIndex++
					} else {
						// Add to current field
						currentField += (currentField.length > 0 ? '\n' : '') + entry
					}
				}

				// Add the last field
				if (currentField.length > 0) {
					embed.fields.push({
						name: fieldIndex === 1 ? `❌ All Penalized Players (${penaltyDetails.length} total)` : `❌ Penalized Players - Part ${fieldIndex}`,
						value: currentField,
						inline: false,
					})
				}
			}
		}

		// Check if embed might exceed Discord limits and handle accordingly
		const embedLength = this.calculateEmbedLength(embed)

		if (testMode) {
			this.logger.log(`🧪 TEST MODE: Embed analysis - Length: ${embedLength} chars, Fields: ${embed.fields.length}, Penalty count: ${penaltyDetails.length}`, 'info')
		}

		if (embedLength > 4500 || embed.fields.length > 15) {
			// Split into multiple embeds for safety
			if (testMode) {
				this.logger.log(`🧪 TEST MODE: Embed limits exceeded, splitting into multiple embeds`, 'warn')
			}
			const embeds = this.splitLargeEmbed(embed, penaltyDetails, testMode, {
				colorTestMode: config.colorTestMode,
				colorPenaltiesApplied: config.colorPenaltiesApplied,
			})

			// Send each embed as a separate message to all configured admin log channels
			for (const channelId of adminLogChannels) {
				try {
					if (testMode) {
						this.logger.log(`🧪 TEST MODE: Sending ${embeds.length} embeds as individual messages to channel ${channelId}`, 'info')
					}

					for (let i = 0; i < embeds.length; i++) {
						const embed = embeds[i]
						if (testMode) {
							this.logger.log(`🧪 TEST MODE: Sending message ${i + 1}/${embeds.length}`, 'info')
						}
						await this.logger.discordChannel(channelId, { embeds: [embed] })

						// Small delay between messages to avoid rate limiting
						if (i < embeds.length - 1) {
							await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay
						}
					}
				} catch (error) {
					this.logger.log(`Failed to send inactivity summary to channel ${channelId}: ${error}`, 'error')
				}
			}
		} else {
			// Single embed is safe to send
			for (const channelId of adminLogChannels) {
				try {
					await this.logger.discordChannel(channelId, { embeds: [embed] })
				} catch (error) {
					this.logger.log(`Failed to send inactivity summary to channel ${channelId}: ${error}`, 'error')
				}
			}
		}
	}

	private calculateEmbedLength(embed: any): number {
		let length = 0
		length += embed.title?.length || 0
		length += embed.description?.length || 0
		length += embed.footer?.text?.length || 0
		length += embed.author?.name?.length || 0

		if (embed.fields) {
			for (const field of embed.fields) {
				length += field.name?.length || 0
				length += field.value?.length || 0
			}
		}

		// Add overhead for JSON structure, Discord mentions, formatting, etc.
		// Discord mentions like <@123456789> add extra characters
		// JSON structure adds quotes, brackets, commas, etc.
		const jsonOverhead = Math.max(200, length * 0.1) // At least 200 chars overhead, or 10% of content

		return length + jsonOverhead
	}

	private splitLargeEmbed(
		originalEmbed: any,
		penaltyDetails: Array<{ player: Player, weeklyExp: number, penaltyType: 'deduction' | 'reset', amount: number }>,
		testMode: boolean,
		config: { colorTestMode: number, colorPenaltiesApplied: number }
	) {
		const embeds = []

		// Create main summary embed without penalty details
		const mainEmbed = {
			...originalEmbed,
			fields: originalEmbed.fields.filter((field: any) =>
				!field.name.includes('Penalized Players')
				&& !field.name.includes('All Penalized Players')
			),
		}

		embeds.push(mainEmbed)

		// Create separate embeds for penalty details
		if (penaltyDetails.length > 0) {
			if (testMode) {
				this.logger.log(`🧪 TEST MODE: Creating penalty embeds for ${penaltyDetails.length} players`, 'info')
			}
			const sortedPenaltyDetails = penaltyDetails.sort((a, b) => {
				if (a.amount !== b.amount) {
					return b.amount - a.amount
				}

				return a.weeklyExp - b.weeklyExp
			})

			// Since we're sending each embed as a separate message, we can use a reasonable fixed size
			const maxPlayersPerEmbed = 40 // Reasonable size that ensures each embed stays well under Discord limits

			if (testMode) {
				this.logger.log(`🧪 TEST MODE: Creating embeds with ${maxPlayersPerEmbed} players each (${sortedPenaltyDetails.length} total players)`, 'info')
			}

			let currentPage = 1

			for (let i = 0; i < sortedPenaltyDetails.length; i += maxPlayersPerEmbed) {
				const pageDetails = sortedPenaltyDetails.slice(i, i + maxPlayersPerEmbed)
				const totalPages = Math.ceil(sortedPenaltyDetails.length / maxPlayersPerEmbed)

				const penaltyEmbed = {
					title: `❌ Penalized Players Details ${totalPages > 1 ? `(Page ${currentPage}/${totalPages})` : ''}`,
					description: `Complete list of players who received penalties for inactivity`,
					color: testMode ? config.colorTestMode : config.colorPenaltiesApplied,
					fields: [] as Array<{ name: string, value: string, inline: boolean }>,
					timestamp: new Date().toISOString(),
					footer: {
						text: `${testMode ? '🧪 TEST MODE • ' : ''}Showing ${i + 1}-${Math.min(i + maxPlayersPerEmbed, sortedPenaltyDetails.length)} of ${sortedPenaltyDetails.length} penalized players`,
					},
				}

				// Split players into fields with very conservative limits to avoid Discord issues
				const playersPerField = 8 // Each player entry ~80 chars, 8 players = ~640 chars (well under 1024 limit)

				for (let j = 0; j < pageDetails.length; j += playersPerField) {
					const fieldPlayers = pageDetails.slice(j, j + playersPerField)
					const fieldNumber = Math.floor(j / playersPerField) + 1
					const totalFieldsThisPage = Math.ceil(pageDetails.length / playersPerField)

					const playersList = fieldPlayers
						.map(({ player, weeklyExp, penaltyType, amount }) => {
							const penaltyText = penaltyType === 'reset' ? `reset to 0` : `${amount} deducted`

							return `<@${player.user.id}> (${weeklyExp} exp weekly, ${penaltyText})`
						})
						.join('\n')

					penaltyEmbed.fields.push({
						name: totalFieldsThisPage > 1 ? `Players (Part ${fieldNumber})` : 'Players',
						value: playersList,
						inline: false,
					})
				}

				// Safety check: Verify embed size before adding
				const embedSize = this.calculateEmbedLength(penaltyEmbed)
				if (testMode) {
					this.logger.log(`🧪 TEST MODE: Penalty embed ${currentPage} size: ${embedSize} chars, fields: ${penaltyEmbed.fields.length}`, 'info')

					// Debug: Show actual JSON size for comparison
					const actualJsonSize = JSON.stringify(penaltyEmbed).length
					this.logger.log(`🧪 TEST MODE: Actual JSON size: ${actualJsonSize} chars (calculated: ${embedSize})`, 'info')

					if (actualJsonSize > 6000) {
						this.logger.log(`🚨 CRITICAL: Actual JSON size ${actualJsonSize} exceeds Discord limit! Skipping this embed.`, 'error')
						continue // Skip this embed to prevent Discord API error
					}
				}

				if (embedSize > 5800) {
					this.logger.log(`⚠️ WARNING: Penalty embed ${currentPage} size (${embedSize}) is close to Discord limit, consider reducing player count`, 'warn')
				}

				embeds.push(penaltyEmbed)
				currentPage++
			}

			if (testMode) {
				this.logger.log(`🧪 TEST MODE: Created ${embeds.length - 1} penalty embeds (plus 1 main embed = ${embeds.length} total)`, 'info')
				this.logger.log(`🧪 TEST MODE: Each embed will be sent as a separate message`, 'info')
			}
		}

		return embeds
	}

	private async createActivityLogFile(
		guild: Guild,
		activePlayers: Array<{ player: Player, weeklyExp: number }>,
		penaltyDetails: Array<{ player: Player, weeklyExp: number, penaltyType: 'deduction' | 'reset', amount: number }>,
		date: string,
		testMode: boolean,
		config: {
			activityThreshold: number
			standardPenaltyAmount: number
			activityCheckPeriod: number
			gracePeriod: number
			reportType: string
		}
	) {
		try {
			const totalPlayers = activePlayers.length + penaltyDetails.length
			const deductionCount = penaltyDetails.filter(p => p.penaltyType === 'deduction').length
			const resetCount = penaltyDetails.filter(p => p.penaltyType === 'reset').length

			// Create comprehensive log content
			const logContent = [
				`================================================================================`,
				`${config.reportType} REPORT - COMPLETE PLAYER LIST`,
				`================================================================================`,
				`Report Date: ${date}`,
				`Guild: ${guild.id}`,
				`Mode: ${testMode ? 'TEST MODE (NO ACTUAL PENALTIES APPLIED)' : 'PRODUCTION MODE'}`,
				``,
				`SUMMARY:`,
				`- Total Eligible Players: ${totalPlayers}`,
				`- Active Players: ${activePlayers.length} (≥${config.activityThreshold} EXP per period)`,
				`- Inactive Players: ${penaltyDetails.length} (<${config.activityThreshold} EXP per period)`,
				`- Deduction Penalties: ${deductionCount} players (${config.standardPenaltyAmount} EXP deducted)`,
				`- Reset Penalties: ${resetCount} players (EXP reset to 0)`,
				`- Activity Rate: ${Math.round((activePlayers.length / totalPlayers) * 100)}%`,
				``,
				`CONFIGURATION:`,
				`- Activity Threshold: ${config.activityThreshold} EXP`,
				`- Standard Penalty Amount: ${config.standardPenaltyAmount} EXP`,
				`- Activity Check Period: ${config.activityCheckPeriod} days`,
				`- Grace Period: ${config.gracePeriod} days`,
				``,
				`================================================================================`,
				`ACTIVE PLAYERS (${activePlayers.length} players)`,
				`================================================================================`,
			]

			// Add active players list (sorted by weekly exp descending)
			if (activePlayers.length > 0) {
				const sortedActivePlayers = activePlayers.sort((a, b) => b.weeklyExp - a.weeklyExp)
				let rank = 1
				for (const { player, weeklyExp } of sortedActivePlayers) {
					logContent.push(`${rank.toString().padStart(3)}. ${player.dcTag.padEnd(30)} | User ID: ${player.user.id.padEnd(20)} | Current EXP: ${player.exp.toString().padStart(6)} | Weekly EXP: ${weeklyExp.toString().padStart(4)}`)
					rank++
				}
			} else {
				logContent.push('No active players found.')
			}

			logContent.push('')
			logContent.push(`================================================================================`)
			logContent.push(`PENALIZED PLAYERS - COMPLETE LIST (${penaltyDetails.length} players)`)
			logContent.push(`================================================================================`)

			// Add penalized players list (sorted by penalty amount desc, then weekly exp asc)
			if (penaltyDetails.length > 0) {
				const sortedPenaltyDetails = penaltyDetails.sort((a, b) => {
					if (a.amount !== b.amount) {
						return b.amount - a.amount // Higher penalty amount first
					}

					return a.weeklyExp - b.weeklyExp // Lower weekly exp first (more inactive)
				})

				let rank = 1
				for (const { player, weeklyExp, penaltyType, amount } of sortedPenaltyDetails) {
					const penaltyText = penaltyType === 'reset' ? 'RESET TO 0' : `${amount} EXP DEDUCTED`
					const beforeExp = penaltyType === 'reset' ? player.exp : player.exp
					const afterExp = penaltyType === 'reset' ? 0 : Math.max(0, player.exp - amount)

					logContent.push(`${rank.toString().padStart(3)}. ${player.dcTag.padEnd(30)} | User ID: ${player.user.id.padEnd(20)} | Before: ${beforeExp.toString().padStart(6)} EXP | After: ${afterExp.toString().padStart(6)} EXP | Weekly: ${weeklyExp.toString().padStart(4)} EXP | Penalty: ${penaltyText}`)
					rank++
				}
			} else {
				logContent.push('No players were penalized.')
			}

			logContent.push('')
			logContent.push(`================================================================================`)
			logContent.push(`END OF REPORT`)
			logContent.push(`Generated: ${new Date().toISOString()}`)
			logContent.push(`================================================================================`)

			// Write to dedicated log file
			const reportTypeSafe = config.reportType.toLowerCase().replace(/\s+/g, '_')
			const logFileName = `${reportTypeSafe}_${guild.id}_${date.replace(/-/g, '')}_${testMode ? 'TEST' : 'PROD'}.log`
			const fullLogContent = logContent.join('\n')

			// Create the logs directory if it doesn't exist
			const fs = await import('node:fs')
			const path = await import('node:path')
			const logsDir = path.join(process.cwd(), 'logs')
			const logFilePath = path.join(logsDir, logFileName)

			// Ensure logs directory exists
			if (!fs.existsSync(logsDir)) {
				fs.mkdirSync(logsDir, { recursive: true })
			}

			// Write the complete log file
			fs.writeFileSync(logFilePath, fullLogContent, 'utf8')

			// Also write to standard logger for backup
			this.logger.file(`WEEKLY ACTIVITY COMPLETE LOG - Guild ${guild.id} (${date}): Log file created at ${logFilePath}`, 'info')

			if (testMode) {
				this.logger.log(`🧪 TEST MODE: Created complete activity log file: ${logFilePath}`, 'info')
			} else {
				this.logger.log(`📄 Created complete activity log file: ${logFilePath}`, 'info')
			}
		} catch (error) {
			this.logger.log(`Failed to create weekly activity log file: ${error}`, 'error')
		}
	}

	private calculatePlayerLevel(exp: number): number {
		// Level to EXP mapping (same as in roles.ts)
		const totalExpLevelMapping: Record<number, number> = {
			5: 60,
			10: 320,
			15: 1285,
			20: 4845,
			25: 16675,
			30: 31675,
			35: 46675,
			40: 61675,
			45: 76675,
			50: 91675,
			55: 106675,
			60: 121675,
			65: 136675,
			70: 151675,
			75: 166675,
			80: 181675,
			85: 196675,
			90: 211675,
			95: 226675,
			100: 241675,
		}

		let currentLevel = 0
		for (const [level, expRequired] of Object.entries(totalExpLevelMapping)) {
			if (exp >= expRequired) {
				currentLevel = Number(level)
			}
		}

		return currentLevel
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
