import { Entity, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/sqlite'

import { CustomBaseEntity } from './BaseEntity'
import { Guild } from './Guild'
import { Player } from './Player'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => QuestRepository })
export class Quest extends CustomBaseEntity {

	[EntityRepositoryType]?: QuestRepository

	@PrimaryKey()
	id: string = this.generateUniqueID()

	@ManyToOne()
	publisher!: Player

	@ManyToOne()
	guild!: Guild

	@ManyToOne()
	reviewer: Player

	@Property()
	name: string

	@Property()
	description: string

	@Property()
	multipleTakers: boolean = true

	@Property()
	repeatable: boolean = true

	@Property()
	rewardDescription: string

	@Property()
	expireDate: Date

	@Property()
	reviewDate: Date

	@Property()
	approveDate: Date

	@Property()
	publishedByAdmin: boolean = false

	private generateUniqueID(prefix: string = 'Q'): string {
		// generate a unique ID that start with the prefix and followed by a random text of 8 characters with numbers and letters
		return prefix + Math.random().toString(36).substring(2, 12)
	}

	addTimeDelta(currentTime: Date, timeDelta: { days: number, hours: number, minutes: number, seconds: number }): Date {
		currentTime.setDate(currentTime.getDate() + timeDelta.days)
		currentTime.setHours(currentTime.getHours() + timeDelta.hours)
		currentTime.setMinutes(currentTime.getMinutes() + timeDelta.minutes)
		currentTime.setSeconds(currentTime.getSeconds() + timeDelta.seconds)

		return currentTime
	}

	parseDurationText(durationText: string): { days: number, hours: number, minutes: number, seconds: number } {
		// duration text will be in format of "1w1d2h3m4s"
		// we will parse this text and calculate the total duration in time delta that can be added to Date() object
		const duration = {
			days: 30,
			hours: 0,
			minutes: 0,
			seconds: 0,
		}
		try {
			const durationTextArray = durationText.match(/\d+[wdhms]/g)
			for (const text of durationTextArray!) {
				const unit = text[text.length - 1]
				const value = Number.parseInt(text.slice(0, -1))
				switch (unit) {
					case 'w':
						duration.days = value * 7
						break

					case 'd':
						duration.days = value
						break

					case 'h':
						duration.hours = value
						break

					case 'm':
						duration.minutes = value
						break

					case 's':
						duration.seconds = value
						break

					default:
						break
				}
			}
		} catch (error) {
			console.error('Error parsing duration text:', error)
		}
		console.log(duration)

		return duration
	}

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class QuestRepository extends EntityRepository<Quest> {

	async insertQuestAdmin(
		player: Player,
		guild: Guild,
		questName: string,
		questDescription: string,
		questReward: string,
		questMultipleTaker: string,
		questRepeatable: string,
		questDuration: string
	): Promise<Quest> {
		const quest = new Quest()
		quest.publisher = player
		quest.guild = guild
		quest.name = questName
		quest.description = questDescription
		quest.rewardDescription = questReward
		quest.multipleTakers = questMultipleTaker === '1'
		quest.repeatable = questRepeatable === '1'

		// TODO: now only by admin so simplify it
		const now = new Date()
		quest.reviewer = player
		quest.expireDate = quest.addTimeDelta(now, quest.parseDurationText(questDuration))
		quest.reviewDate = now
		quest.approveDate = now
		quest.publishedByAdmin = true

		await this.em.persistAndFlush(quest)

		return quest
	}

}
