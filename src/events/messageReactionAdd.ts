import { ArgsOf, Client } from 'discordx'

import { Discord, Guard, Injectable, On } from '@/decorators'
import {
	DailyCounter,
	DailyCounterRepository,
	Guild,
	GuildConfigItem,
	GuildConfigItemRepository,
	GuildRepository,
	Player,
	PlayerRepository,
	Quest,
	QuestRecord,
	QuestRecordRepository,
	QuestRepository,
	User,
	UserRepository,
	ValueChangeLog,
	ValueChangeLogRepository,
} from '@/entities'
import { Maintenance } from '@/guards'
import { Database, Logger } from '@/services'

@Discord()
@Injectable()
export default class MessageReactionAddEvent {

	// guildConfig = {
	// 	guild: [
	// 		{   channelId: string
	// 			emoji: string
	// 			reward: number
	// 			rewardType: string
	// 		}
	//      {   channelId: string
	//			emoji: string
	//			reward: number
	//			rewardType: string
	//		}
	// 	]
	// }
	private guildConfig: any
	private configRepo: GuildConfigItemRepository
	private guildRepo: GuildRepository
	private questRepo: QuestRepository
	private questRecordRepo: QuestRecordRepository
	private dailyCounterRepo: DailyCounterRepository
	private playerRepo: PlayerRepository
	private valueChangeLogRepo: ValueChangeLogRepository
	private userRepo: UserRepository
	private marked: string[]

	constructor(
		private db: Database,
		private logger: Logger
	) {
		this.configRepo = this.db.get(GuildConfigItem)
		this.guildRepo = this.db.get(Guild)
		this.questRepo = this.db.get(Quest)
		this.questRecordRepo = this.db.get(QuestRecord)
		this.dailyCounterRepo = this.db.get(DailyCounter)
		this.playerRepo = this.db.get(Player)
		this.valueChangeLogRepo = this.db.get(ValueChangeLog)
		this.userRepo = this.db.get(User)
		this.marked = []
	}

	@On('messageReactionAdd')
	@Guard(
		Maintenance
	)
	async messageReactionAddHandler(
		[messageReaction, user]: ArgsOf<'messageReactionAdd'>,
		client: Client
	) {
		// check if the reaction is from a bot
		if (user.bot) return

		const message = messageReaction.message
		const channel = message.channel
		const emoji = messageReaction.emoji

		if (!message.author) return
		if (this.marked.includes(message.id)) return

		const guild = messageReaction.message.guild
		if (!guild) return
		const guildEntity = await this.guildRepo.findOne({ id: guild.id })
		if (!guildEntity) return

		const missionDivRolesConfig = await this.configRepo.get('missionDivRole', guildEntity)
		const missionDivRoles = missionDivRolesConfig !== null
			? (JSON.parse(missionDivRolesConfig.value) as string[])
			: []

		// check if any of the roles of the user is included in missionDivRoles
		const member = await guild.members.fetch(user.id)
		const hasRole = member.roles.cache.some(role => missionDivRoles.includes(role.id))
		if (!hasRole) return

		// Reload configuration if expired or not loaded yet
		if (!this.guildConfig || !this.guildConfig[guild.id] || (Date.now() - this.guildConfig[guild.id].age > 20 * 1000)) {
			try {
				// Reload guild configuration (reuse guildEntity from above)
				const configItems = await this.configRepo.getAllByType(guildEntity, 'mission')
				this.guildConfig = this.guildConfig || {}
				this.guildConfig[guild.id] = {
					age: Date.now(),
					config: configItems.map((item) => {
						const parsedValue = JSON.parse(item.value)

						return {
							...parsedValue,
							questId: item.name,
						}
					}),
				}
			} catch (error) {
				this.logger.log(`Failed to load guild configuration for guild ${guild.id}`, 'error')

				return
			}
		}

		// find all monitored channels
		const monitoredChannels = this.guildConfig[guild.id].config.map((item: any) => item.channelId)
		if (!monitoredChannels.includes(channel.id)) {
			return
		}

		// Loop through the guild configuration to find matching channel and emoji
		for (const configItem of this.guildConfig[guild.id].config) {
			if (configItem.channelId === channel.id && configItem.emojiId === emoji.name) {
				try {
					const quest = await this.questRepo.findOne({ id: configItem.questId })
					if (!quest) {
						this.logger.log(`Quest not found for quest ID ${configItem.questId}`, 'error')

						return
					}

					// Check if quest has expired
					const now = new Date()
					if (quest.expireDate && quest.expireDate < now) {
						this.logger.log(`Quest ${quest.name} (${configItem.questId}) has expired. Expiry date: ${quest.expireDate.toISOString()}`, 'info')

						return
					}

					// 0. check whether there are existing quest records for this user
					const messageDate = new Date(message.createdAt)

					// For repeatable quests, check for completion on the same day as the original message
					const messageDayStart = new Date(messageDate)
					messageDayStart.setHours(0, 0, 0, 0)
					const messageDayEnd = new Date(messageDate)
					messageDayEnd.setHours(23, 59, 59, 999)

					const existingRecords = await this.questRecordRepo.find({
						taker: { id: `${message.author.id}-${guild.id}` },
						quest: { id: configItem.questId },
						completeDate: { $gte: messageDayStart, $lte: messageDayEnd },
						questEnded: true,
					})

					if (existingRecords.length > 0) {
						this.logger.log(`User ${message.author.tag} has already completed the quest ${configItem.questId} on ${messageDate.toDateString()}.`, 'info')

						return // terminate here
					}

					// 1. Add quest record to the user
					const player = await this.playerRepo.findOne(
						{ id: `${message.author.id}-${guild.id}` },
						{ cache: false, refresh: true }
					)
					if (!player) {
						this.logger.log(`Player not found for user ${user.id}`, 'error')

						return
					}

					// check if this message has been used for exp
					const existingRecord = await this.questRecordRepo.findOne({ quest, taker: player, recordNote: message.id })
					if (existingRecord) return // already used

					// 1.1 Calculate historical daily exp usage for the message date
					if (configItem.rewardType === 'exp') {
						const historicalExpUsed = await this.calculateHistoricalDailyExp(player, messageDate)
						const expDoubleLimitConfig = await this.configRepo.get('expDoubleLimit', guildEntity)
						const expDoubleLimit = expDoubleLimitConfig !== null ? JSON.parse(expDoubleLimitConfig.value) : 4805

						// Get the daily mission exp limit for that historical date
						const dailyMissionExpLimit = player.exp >= expDoubleLimit ? 200 : 100 // Base limit * factor

						if (historicalExpUsed >= dailyMissionExpLimit) {
							this.logger.log(`用户 ${player.dcTag} 在 ${messageDate.toDateString()} 已经达到每日任务经验上限 (${historicalExpUsed}/${dailyMissionExpLimit})！`, 'info')

							return // terminate here
						}
					}

					const questRecord = await this.questRecordRepo.insertQuestRecordWithNote(quest, player, message.id, message.createdAt)

					// 2. Complete the quest record
					const reviewer = await this.playerRepo.findOne({ id: `${user.id}-${guild.id}` })
					if (!reviewer) {
						this.logger.log(`Reviewer not found for user ${user.id}`, 'error')
						// revoke step 1, remove questRecord and perist and flush the change
						await this.questRecordRepo.getEntityManager().remove(questRecord).flush()

						return
					}

					questRecord.reviewer = reviewer
					questRecord.needReview = false
					questRecord.questEnded = true
					questRecord.completeDate = message.createdAt // Use message creation date instead of current time
					await this.db.em.persistAndFlush(questRecord)

					// 3. Assign the reward to the user
					let valueChanged: number
					if (configItem.rewardType === 'exp') {
						// Calculate reward based on historical context
						const historicalExpUsed = await this.calculateHistoricalDailyExp(player, messageDate)
						const expDoubleLimitConfig = await this.configRepo.get('expDoubleLimit', guildEntity)
						const expDoubleLimit = expDoubleLimitConfig !== null ? JSON.parse(expDoubleLimitConfig.value) : 4805

						// Determine base reward (with potential multiplier)
						const baseReward = player.exp >= expDoubleLimit ? configItem.reward * 2 : configItem.reward

						// Calculate daily limit for that historical date
						const dailyMissionExpLimit = player.exp >= expDoubleLimit ? 200 : 100

						// Calculate how much exp can still be awarded for that historical date
						const remainingDailyExp = Math.max(0, dailyMissionExpLimit - historicalExpUsed)

						// Award the minimum of base reward and remaining daily allowance
						valueChanged = Math.min(baseReward, remainingDailyExp)

						if (valueChanged <= 0) {
							this.logger.log(`用户 ${player.dcTag} 在 ${messageDate.toDateString()} 的每日任务经验已用完，无法获得更多经验`, 'info')

							return
						}
					} else if (configItem.rewardType === 'silver') {
						valueChanged = configItem.reward
					} else {
						return
					}

					await this.db.em.refresh(player)
					const prevValue = player[configItem.rewardType === 'exp' ? 'exp' : 'silver']
					await this.playerRepo.updatePlayerValue(
						{ id: player.id },
						valueChanged,
						configItem.rewardType === 'exp' ? 'exp' : 'silver'
					)

					if (configItem.rewardType === 'exp') {
						player.exp += valueChanged
					} else if (configItem.rewardType === 'silver') {
						player.silver += valueChanged
					}
					await this.db.em.persistAndFlush(player)
					await this.db.em.refresh(player)
					const postValue = player[configItem.rewardType === 'exp' ? 'exp' : 'silver']

					// 4. Log the exp/silver change to value change log
					const adminUser = await this.userRepo.findOne({ id: user.id })
					if (!adminUser) {
						this.logger.log(`Admin user not found for user ${user.id}`, 'error')

						return
					}
					await this.valueChangeLogRepo.insertLog(player, adminUser, valueChanged, configItem.rewardType === 'exp' ? 'exp' : 'silver', `任务奖励 - ${quest.name} - 频道 ${channel.id} - prev: ${prevValue} - post: ${postValue}`)
					const rewardMessage = `<@${message.author.id}> 在频道 <#${channel.id}> 完成任务 ${quest.name} 收到了 ${valueChanged} ${configItem.rewardType} 的任务奖励`

					// 5. Send quest complete message to mission broadcast channel
					const missionBroadcastChannelConfig = await this.configRepo.get('missionBroadcastChannel', guildEntity)
					const missionBroadcastChannel = missionBroadcastChannelConfig !== null
						? (JSON.parse(missionBroadcastChannelConfig.value) as string[])
						: []

					missionBroadcastChannel.forEach((channelId) => {
						this.logger.log(rewardMessage, 'info', true, channelId)
					})

					// 6. Send quest complete message to the message author by DM
					try {
						const dmUser = await client.users.fetch(player.user.id)
						await dmUser.send(rewardMessage)
					} catch (dmError) {
						this.logger.log(`Failed to send DM to user ${player.user.id}: ${dmError}`, 'warn')
						// Continue execution even if DM fails
					}

					this.marked.push(message.id)
				} catch (error) {
					this.logger.log(`Error processing quest for user ${message.author.tag}: ${error}`, 'error')
				}

				break
			}
		}
	}

	/**
	 * Calculate the total daily mission exp already used on a specific historical date
	 * @param player The player to check
	 * @param targetDate The historical date to check
	 * @returns Total exp already used on that date
	 */
	private async calculateHistoricalDailyExp(player: Player, targetDate: Date): Promise<number> {
		const dayStart = new Date(targetDate)
		dayStart.setHours(0, 0, 0, 0)
		const dayEnd = new Date(targetDate)
		dayEnd.setHours(23, 59, 59, 999)

		let totalExpUsed = 0

		// Calculate total exp from value change logs for that date
		const valueLogs = await this.valueChangeLogRepo.find({
			player,
			createdAt: { $gte: dayStart, $lte: dayEnd },
			type: 'exp',
			note: { $like: '任务奖励%' }, // Filter for quest rewards
		})

		for (const log of valueLogs) {
			if (log.amount > 0) { // Only count positive changes (rewards)
				totalExpUsed += log.amount
			}
		}

		return totalExpUsed
	}

}
