import { Entity, EntityRepository, EntityRepositoryType, PrimaryKey, Property } from '@mikro-orm/core'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => PastebinRepository })
export class Pastebin {

	[EntityRepositoryType]?: PastebinRepository

	@PrimaryKey({ autoincrement: false })
    id: string

	@Property()
    editCode: string

	@Property()
    lifetime: number = -1

	@Property()
    createdAt: Date = new Date()

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class PastebinRepository extends EntityRepository<Pastebin> {

}
