import { Entity, EntityRepository, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { Guild as DGuild, User as DUser } from 'discord.js'

import { CustomBaseEntity } from './BaseEntity'
import { Guild } from './Guild'
import { User } from './User'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => PlayerRepository })
export class Player extends CustomBaseEntity {

	[EntityRepositoryType]?: PlayerRepository

	@PrimaryKey({ autoincrement: false })
    id!: string

	@ManyToOne()
    user!: User

	@ManyToOne()
    guild!: Guild

	@Property()
	dcTag!: string

	@Property()
    exp: number = 0

	@Property()
	sliver: number = 0

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class PlayerRepository extends EntityRepository<Player> {

	async addPlayer(user: DUser, guild: DGuild): Promise<Player> {
		const player = new Player()
		player.id = `${user.id}-${guild.id}` // Assuming a composite key
		player.user = await this.em.findOneOrFail(User, { id: user.id })
		player.guild = await this.em.findOneOrFail(Guild, { id: guild.id })
		player.dcTag = user.tag
		player.exp = 0
		await this.em.persistAndFlush(player)

		return player
	}

	async updatePlayerValue(filterQuery: object, valueDelta: number, type: 'exp' | 'silver'): Promise<boolean> {
		await this.em.flush()
		const player = await this.findOne(
			filterQuery,
			{ cache: false, refresh: true }
		)
		if (!player) return false

		if (type === 'silver') player.sliver += valueDelta
		if (type === 'exp') player.exp += valueDelta

		await this.em.persistAndFlush(player)

		return true
	}

}
