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
	type: 'channel' | 'mission' | 'role' | 'user' | 'value'

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class GuildConfigItemRepository extends EntityRepository<GuildConfigItem> {

	async get(name: string, guild: Guild): Promise<GuildConfigItem | null> {
		const data = await this.findOne({ name, guild })

		return data
	}

	async getAllByType(guild: Guild, type: 'channel' | 'mission' | 'role' | 'user' | 'value'): Promise<GuildConfigItem[]> {
		const data = await this.find({ guild, type })

		return data
	}

	async set(name: string, value: string, type: 'channel' | 'mission' | 'role' | 'user' | 'value', guild: Guild): Promise<GuildConfigItem> {
	async set(name: string, value: string | object, type: 'channel' | 'mission' | 'role' | 'user' | 'value', guild: Guild): Promise<GuildConfigItem> {
		const item = await this.findOne({ name, guild })
		if (!item) {
			const newItem = new GuildConfigItem()
			newItem.name = name
			if (type !== 'mission' && type !== 'value') {
				newItem.value = JSON.stringify([value])
			} else {
				newItem.value = JSON.stringify(value)
			}
			newItem.type = type
			newItem.guild = guild

			await this.em.persistAndFlush(newItem)

			return newItem
		} else {
			item.value = JSON.stringify(value)
			await this.em.persistAndFlush(item)

			return item
		}
	}

	async getAllConfigByGuild(guild: Guild): Promise<GuildConfigItem[]> {
		const data = await this.find({ guild })

		return data
	}

}
