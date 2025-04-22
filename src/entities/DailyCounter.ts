import { Entity, EntityRepository, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'

import { CustomBaseEntity } from './BaseEntity'
import { Guild } from './Guild'
import { GuildConfigItem } from './GuildConfigItem'
import { Player } from './Player'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => DailyCounterRepository })
export class DailyCounter extends CustomBaseEntity {

	[EntityRepositoryType]?: DailyCounterRepository

	@PrimaryKey({ autoincrement: true })
	id: number

	@ManyToOne()
	player!: Player

	@Property()
	playerDcTag!: string

	@Property()
	chatExp: number = 10

	@Property()
	voiceExp: number = 90

	@Property()
	dailyMissionExp: number = 100

	resetCounter(factor: number = 1) {
		this.resetChatExp(factor)
		this.resetVoiceExp(factor)
		this.resetDailyMissionExp(factor)
	}

	resetChatExp(factor: number = 1) {
		this.chatExp = 10 * factor
	}

	resetVoiceExp(factor: number = 1) {
		this.voiceExp = 90 * factor
	}

	resetDailyMissionExp(factor: number = 1) {
		this.dailyMissionExp = 100 * factor
	}

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DailyCounterRepository extends EntityRepository<DailyCounter> {

	async initCounter(player: Player): Promise<DailyCounter> {
		const counter = new DailyCounter()
		counter.player = player
		counter.playerDcTag = player.dcTag

		const expDoubleLimitConfig = await this.em.getRepository(GuildConfigItem).get('expDoubleLimit', player.guild)
		const expDoubleLimit = expDoubleLimitConfig !== null ? JSON.parse(expDoubleLimitConfig!.value) : 4845

		counter.resetCounter(player.exp >= expDoubleLimit ? 2 : 1)
		await this.em.persistAndFlush(counter)

		return counter
	}

	async updateCounter(player: Player, value: number, updateType: 'chat' | 'voice' | string): Promise<number> {
		// either find or make a new one if not yet in database
		const counter = await this.findOne({ player }) ?? await this.initCounter(player)

		if (updateType !== 'chat' && updateType !== 'voice') {
			if (updateType === 'dailyMission') {
				// value = counter.dailyMissionExp
				const valueChanged = Math.min(counter.dailyMissionExp, value)
				counter.dailyMissionExp -= valueChanged
				await this.em.persistAndFlush(counter)

				return valueChanged
			} else {
				throw new Error('Invalid update type')
			}
		}

		const expType = updateType === 'chat' ? 'chatExp' : 'voiceExp'
		const valueChanged = Math.min(counter[expType], value)
		counter[expType] -= valueChanged

		await this.em.persistAndFlush(counter)

		return valueChanged
	}

	async resetAllCountersByGuild(guild: Guild) {
		const allCounters = await this.find({ player: { guild } })
		
		// Remove all counters from the given guild
		await this.em.removeAndFlush(allCounters)
	}

}
