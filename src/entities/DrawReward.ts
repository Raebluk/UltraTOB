import { Entity, EntityRepository, EntityRepositoryType, PrimaryKey, Property } from '@mikro-orm/core'

import { CustomBaseEntity } from './BaseEntity'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => DrawRewardRepository })
export class DrawReward extends CustomBaseEntity {

	[EntityRepositoryType]?: DrawRewardRepository

	@PrimaryKey()
	id!: number

	@Property()
	name!: string

	@Property()
	type!: 'exp' | 'silver' | 'other'

	@Property()
	value: number = 0

	@Property()
	probability!: number

	@Property({ default: true })
	enabled: boolean = true

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DrawRewardRepository extends EntityRepository<DrawReward> {

	async getEnabledRewards(): Promise<DrawReward[]> {
		return await this.find({ enabled: true }, { orderBy: { probability: 'DESC' } })
	}

	async initializeDefaultRewards(): Promise<void> {
		const existingRewards = await this.count()
		if (existingRewards > 0) return

		const defaultRewards = [
			{ name: '0点经验', type: 'exp' as const, value: 0, probability: 40.00 },
			{ name: '100点经验', type: 'exp' as const, value: 100, probability: 58.90 },
			{ name: '500点经验', type: 'exp' as const, value: 500, probability: 1.00 },
			{ name: '$60以内游戏一份', type: 'other' as const, value: 60, probability: 0.08 },
			{ name: '$100以内游戏一份', type: 'other' as const, value: 100, probability: 0.02 },
		]

		for (const reward of defaultRewards) {
			const drawReward = new DrawReward()
			drawReward.name = reward.name
			drawReward.type = reward.type
			drawReward.value = reward.value
			drawReward.probability = reward.probability
			this.em.persist(drawReward)
		}

		await this.em.flush()
	}

}
