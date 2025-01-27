import { Entity, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/sqlite'

import { CustomBaseEntity } from './BaseEntity'
import { Player } from './Player'
import { Quest } from './Quest'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => QuestRecordRepository })
export class QuestRecord extends CustomBaseEntity {

	[EntityRepositoryType]?: QuestRecordRepository

	@PrimaryKey({ autoincrement: true })
	id: number

	@ManyToOne()
	quest!: Quest

	@ManyToOne()
	taker!: Player

	@ManyToOne()
	reviewer: Player

	@Property()
	needReview: boolean

	@Property()
	completeDate: Date

	@Property()
	failDate: Date

	@Property()
	questEnded: boolean

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class QuestRecordRepository extends EntityRepository<QuestRecord> {

}
