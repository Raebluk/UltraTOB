import { Entity, EntityRepository, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'

import { CustomBaseEntity } from './BaseEntity'
import { Guild } from './Guild'
import { User } from './User'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => PlayerMetadataRepository })
export class PlayerMetadata extends CustomBaseEntity {

	[EntityRepositoryType]?: PlayerMetadataRepository

	@PrimaryKey({ autoincrement: false })
    id!: string

	@ManyToOne()
    user!: User

	@ManyToOne()
    guild!: Guild

	@Property()
	initSilverGiven: boolean = false

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class PlayerMetadataRepository extends EntityRepository<PlayerMetadata> {
}
