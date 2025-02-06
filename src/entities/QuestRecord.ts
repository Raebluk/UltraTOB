import { Entity, EntityRepository, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'

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

	@ManyToOne({ nullable: true })
	reviewer?: Player

	@Property()
	needReview: boolean = false

	@Property({ nullable: true })
	completeDate: Date

	@Property({ nullable: true })
	failDate: Date

	@Property()
	questEnded: boolean = false

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class QuestRecordRepository extends EntityRepository<QuestRecord> {

	async insertQuestRecord(quest: Quest, taker: Player): Promise<QuestRecord> {
		const questRecord = new QuestRecord()
		questRecord.taker = taker
		questRecord.quest = quest

		await this.em.persistAndFlush(questRecord)

		return questRecord
	}

}
