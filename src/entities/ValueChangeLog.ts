import { Entity, EntityRepository, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'

import { CustomBaseEntity } from './BaseEntity'
import { Player } from './Player'
import { User } from './User'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => ValueChangeLogRepository })
export class ValueChangeLog extends CustomBaseEntity {

	[EntityRepositoryType]?: ValueChangeLogRepository

	@PrimaryKey({ autoincrement: true })
	id: number

	@ManyToOne()
	player!: Player

	@Property()
	playerDcTag!: string

	@Property()
	amount!: number

	@Property({ type: 'string' })
	type!: 'exp' | 'silver' | 'unknown'

	@Property()
	note: string

	@ManyToOne()
	moderator!: User

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class ValueChangeLogRepository extends EntityRepository<ValueChangeLog> {

	async insertLog(player: Player, moderator: User, amount: number, type: 'exp' | 'silver' | 'unknown', note: string = ''): Promise<ValueChangeLog> {
		const log = new ValueChangeLog()
		log.player = player
		log.playerDcTag = player.dcTag
		log.moderator = moderator
		log.amount = amount
		log.type = type
		log.note = note
		await this.em.persistAndFlush(log)

		return log
	}

}
