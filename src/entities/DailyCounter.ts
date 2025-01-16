import { Entity, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { AnyString } from '@mikro-orm/core/typings'
import { EntityRepository } from '@mikro-orm/sqlite'

import { CustomBaseEntity } from './BaseEntity'
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

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DailyCounterRepository extends EntityRepository<DailyCounter> {

	async initCounter(player: Player): Promise<DailyCounter> {
		const counter = new DailyCounter()
		counter.player = player
		counter.playerDcTag = player.dcTag
		await this.em.persistAndFlush(counter)

		return counter
	}

	async updateCounter(player: Player, value: number, updateType: 'chat' | 'voice' | string): Promise<number> {
		// either find or make a new one if not yet in database
		const counter = await this.findOne({ player }) ?? await this.initCounter(player)

		if (updateType !== 'chat' && updateType !== 'voice') {
			throw new Error('Invalid update type')
		}

		const expType = updateType === 'chat' ? 'chatExp' : 'voiceExp'
		const valueChanged = Math.min(counter[expType], value)
		counter[expType] -= valueChanged

		await this.em.persistAndFlush(counter)

		return valueChanged
	}

}
