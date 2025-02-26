import { Entity, EntityRepository, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'

import { CustomBaseEntity } from './BaseEntity'
import { Guild } from './Guild'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => GuildConfigItemRepository })
export class GuildConfigItem extends CustomBaseEntity {

	[EntityRepositoryType]?: GuildConfigItemRepository

	@PrimaryKey({ autoincrement: true })
	id: number

	@Property()
    name!: string

	@ManyToOne()
    guild!: Guild

	@Property()
    value: string = ''

	@Property({ type: 'string' })
	type: 'channel' | 'mission' | 'role' | 'user'

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class GuildConfigItemRepository extends EntityRepository<GuildConfigItem> {

	async get(name: string, guild: Guild): Promise<GuildConfigItem | null> {
		const data = await this.findOne({ name, guild })

		return data
	}

	async set(name: string, value: string, type: 'channel' | 'mission' | 'role' | 'user', guild: Guild): Promise<GuildConfigItem> {
		const item = await this.findOne({ name, guild })
		if (!item) {
			const newItem = new GuildConfigItem()
			newItem.name = name
			if (type !== 'mission') {
				newItem.value = JSON.stringify([value])
			} else {
				newItem.value = JSON.stringify(value)
			}
			newItem.type = type

			await this.em.persistAndFlush(newItem)

			return newItem
		} else {
			item.value = JSON.stringify(value)
			await this.em.flush()

			return item
		}
	}

	async getAllConfigByGuild(guild: Guild): Promise<GuildConfigItem[]> {
		const data = await this.find({ guild })

		return data
	}

}
