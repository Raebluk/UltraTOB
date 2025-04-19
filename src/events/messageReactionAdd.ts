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
				// Fetch guild entity from the database
				const guildEntity = await this.guildRepo.findOne({ id: guild.id })

				// Reload guild configuration
				const configItems = await this.configRepo.getAllByType(guildEntity!, 'mission')
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
				// Check if the user has the "mission admin" role

				const admin = await guild.members.fetch(user.id)
				const adminUser = await this.userRepo.findOne({ id: user.id })
				if (!adminUser) return
				try {
					// 1. Add quest record to the user
					await this.playerRepo.getEntityManager().flush()
					const player = await this.playerRepo.findOne(
						{ id: `${message.author.id}-${guild.id}` },
						{ cache: false, refresh: true }
					)
					if (!player) {
						this.logger.log(`Player not found for user ${user.id}`, 'error')

						return
					}

					// 1.1 Fetch the counter of the player
					let counter = await this.dailyCounterRepo.findOne({ player })
					if (!counter) {
						counter = await this.dailyCounterRepo.initCounter(player)
					}
					if (counter.dailyMissionExp <= 0 && configItem.rewardType === 'exp') {
						this.logger.log(`用户 ${player.dcTag} 本日已经没有任务经验余额了！`, 'info')

						return // terminate here
					}

					const quest = await this.questRepo.findOne({ id: configItem.questId })
					if (!quest) {
						this.logger.log(`Quest not found for quest ID ${configItem.questId}`, 'error')

						return
					}

					// check if this message has been used for exp
					const existingRecord = await this.questRecordRepo.findOne({ quest, taker: player, recordNote: message.id })
					if (existingRecord) return // already used

					const questRecord = await this.questRecordRepo.insertQuestRecordWithNote(quest, player, message.id)

					// 2. Complete the quest record
					const reviewer = await this.playerRepo.findOne({ id: `${admin!.id}-${guild.id}` })
					if (!reviewer) {
						this.logger.log(`Reviewer not found for user ${admin!.id}`, 'error')
						// revoke step 1, remove questRecord and perist and flush the change
						await this.questRecordRepo.getEntityManager().remove(questRecord).flush()

						return
					}

					questRecord.reviewer = reviewer
					questRecord.needReview = false
					questRecord.questEnded = true
					questRecord.completeDate = new Date()
					await this.db.em.persistAndFlush(questRecord)

					// 3. Assign the reward to the user

					let valueChanged: number
					if (configItem.rewardType === 'exp') {
						// TODO: config it
						if (player.exp > 4805) {
							valueChanged = await this.dailyCounterRepo.updateCounter(player, configItem.reward * 2, 'dailyMission')
						} else {
							valueChanged = await this.dailyCounterRepo.updateCounter(player, configItem.reward, 'dailyMission')
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
						player.exp += configItem.reward
					} else if (configItem.rewardType === 'silver') {
						player.silver += configItem.reward
					}
					await this.db.em.persistAndFlush(player)
					await this.db.em.refresh(player)
					const postValue = player[configItem.rewardType === 'exp' ? 'exp' : 'silver']

					// 4. Log the exp/silver change to value change log
					await this.valueChangeLogRepo.insertLog(player, adminUser, valueChanged, configItem.rewardType === 'exp' ? 'exp' : 'silver', `任务奖励 - ${quest.name} - 频道 ${channel.id} - prev: ${prevValue} - post: ${postValue}`)
					const rewardMessage = `<@${message.author.tag}> 在频道 <#${channel.id}> 完成任务 ${quest.name} 收到了 ${valueChanged} ${configItem.rewardType} 的任务奖励`

					// 5. Send quest complete message to mission broadcast channel
					const missionBroadcastChannelConfig = await this.configRepo.get('missionBroadcastChannel', guildEntity)
					const missionBroadcastChannel = missionBroadcastChannelConfig !== null
						? (JSON.parse(missionBroadcastChannelConfig.value) as string[])
						: []

					missionBroadcastChannel.forEach((channelId) => {
						this.logger.log(rewardMessage, 'info', true, channelId)
					})

					// 6. Send quest complete message to the message author by DM
					client.users.fetch(player.user.id).then((user) => {
						user.send(rewardMessage)
					})

					this.marked.push(message.id)
				} catch (error) {
					this.logger.log(`Error processing quest for user ${message.author.tag}: ${error}`, 'error')
				}

				break
			}
		}
	}

}
