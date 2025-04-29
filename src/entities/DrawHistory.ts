import { Entity, EntityRepository, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'

import { CustomBaseEntity } from './BaseEntity'
import { DrawReward } from './DrawReward'
import { Player } from './Player'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => DrawHistoryRepository })
export class DrawHistory extends CustomBaseEntity {

	[EntityRepositoryType]?: DrawHistoryRepository

	@PrimaryKey()
	id!: number

	@ManyToOne()
	player!: Player

	@ManyToOne()
	reward!: DrawReward

	@Property()
	drawDate: Date = new Date()

}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DrawHistoryRepository extends EntityRepository<DrawHistory> {

	async getTodayDrawCount(player: Player): Promise<number> {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		const tomorrow = new Date(today)
		tomorrow.setDate(tomorrow.getDate() + 1)

		return await this.count({
			player,
			drawDate: {
				$gte: today,
				$lt: tomorrow,
			},
		})
	}

	async getCurrentMonthDrawCount(player: Player): Promise<number> {
		const now = new Date()
		const currentYear = now.getFullYear()
		const currentMonth = now.getMonth()

		// Calculate the start of the current draw period (17th of current or previous month)
		let periodStart: Date
		if (now.getDate() >= 17) {
			// After 17th, period started on 17th of current month
			periodStart = new Date(currentYear, currentMonth, 17, 0, 0, 0, 0)
		} else {
			// Before 17th, period started on 17th of previous month
			periodStart = new Date(currentYear, currentMonth - 1, 17, 0, 0, 0, 0)
		}

		return await this.count({
			player,
			drawDate: {
				$gte: periodStart,
			},
		})
	}

	async addDrawRecord(player: Player, reward: DrawReward): Promise<DrawHistory> {
		const drawHistory = new DrawHistory()
		drawHistory.player = player
		drawHistory.reward = reward
		drawHistory.drawDate = new Date()

		this.em.persist(drawHistory)
		await this.em.flush()

		return drawHistory
	}

	async getPlayerDrawHistory(player: Player, limit: number = 10): Promise<DrawHistory[]> {
		return await this.find(
			{ player },
			{
				orderBy: { drawDate: 'DESC' },
				limit,
				populate: ['reward'],
			}
		)
	}

	async getCurrentMonthRewardCount(rewardValue: number): Promise<number> {
		const now = new Date()
		const currentYear = now.getFullYear()
		const currentMonth = now.getMonth()

		// Calculate the start of the current draw period (17th of current or previous month)
		let periodStart: Date
		if (now.getDate() >= 17) {
			// After 17th, period started on 17th of current month
			periodStart = new Date(currentYear, currentMonth, 17, 0, 0, 0, 0)
		} else {
			// Before 17th, period started on 17th of previous month
			periodStart = new Date(currentYear, currentMonth - 1, 17, 0, 0, 0, 0)
		}

		return await this.count({
			drawDate: {
				$gte: periodStart,
			},
			reward: {
				type: 'other',
				value: rewardValue,
			},
		})
	}

}
