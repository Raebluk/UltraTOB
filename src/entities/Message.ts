import { Entity, EntityRepository, EntityRepositoryType, PrimaryKey, Property } from '@mikro-orm/core'

import { CustomBaseEntity } from './BaseEntity'
// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => MessageRepository })
export class Message extends CustomBaseEntity {

	[EntityRepositoryType]?: MessageRepository

	@PrimaryKey()
    id!: string

	@Property()
    channel!: string

	@Property()
    value: string = ''

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class MessageRepository extends EntityRepository<Message> {

}
