import { Entity, EntityRepository, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'

import { CustomBaseEntity } from './BaseEntity'
import { Player } from './Player'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => DrawRecordRepository })
export class DrawRecord extends CustomBaseEntity {

	[EntityRepositoryType]?: DrawRecordRepository

	@PrimaryKey({ autoincrement: true })
    id: number

	@ManyToOne()
    drawer!: Player

	@Property()
    reward: string = ''

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DrawRecordRepository extends EntityRepository<DrawRecord> {

	async insertDrawRecord(drawer: Player, reward: string): Promise<DrawRecord> {
		const drawRecord = new DrawRecord()
		drawRecord.drawer = drawer
		drawRecord.reward = reward

		await this.em.persistAndFlush(drawRecord)

		return drawRecord
	}

}
