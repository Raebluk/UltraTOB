import { Entity, EntityRepository, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'

import { CustomBaseEntity } from './BaseEntity'
import { Guild } from './Guild'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => GuildConfigItemRepository })
export class GuildConfigItem extends CustomBaseEntity {

	[EntityRepositoryType]?: GuildConfigItemRepository

	@PrimaryKey()
    name!: string

	@ManyToOne()
    guild!: Guild

	@Property()
    value: string = ''

	@Property({ type: 'string' })
	type: 'channel' | 'mission' | 'role'

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class GuildConfigItemRepository extends EntityRepository<GuildConfigItem> {

	async get(name: string): Promise<object> {
		const data = await this.findOne({ name })

		return JSON.parse(data!.value)
	}

	async set(name: string, value: string, type: 'channel' | 'mission' | 'role'): Promise<void> {
		const item = await this.findOne({ name })
		if (!item) {
			const newItem = new GuildConfigItem()
			newItem.name = name
			newItem.value = JSON.stringify(value)
			newItem.type = type

			await this.em.persistAndFlush(newItem)
		} else {
			item.value = JSON.stringify(value)
			await this.em.flush()
		}
	}

	async getAllConfigByGuild(guild: Guild): Promise<GuildConfigItem[]> {
		const data = await this.find({ guild })

		return data
	}

}
