import { GuildMember, GuildMemberRoleManager } from 'discord.js'
import { Client } from 'discordx'

import { Player } from '@/entities'
import { Logger } from '@/services'
import { resolveDependency } from '@/utils/functions'

// Level to EXP mapping (from user.ts)
const totalExpLevelMapping: Record<number, number> = {
	5: 60,
	10: 320,
	15: 1285,
	20: 4845,
	25: 16675,
	30: 31675,
	35: 46675,
	40: 61675,
	45: 76675,
	50: 91675,
	55: 106675,
	60: 121675,
	65: 136675,
	70: 151675,
	75: 166675,
}

// Level to role ID mapping (from user.ts)
const levelRoleMapping: Record<number, string> = {
	10: '1337585523887177813',
	15: '1351008487571980381',
	20: '1351007105355747390',
	25: '1351007307277926511',
	30: '1351009018918735923',
	35: '1351009016590897183',
	40: '1351009009393598475',
	45: '1351009014506586183',
	50: '1351009012228947968',
	55: '1351009969566257224',
	60: '1351009956370841600',
	65: '1351009941321941053',
	70: '1351009944253497416',
	75: '1351009950964645970',
}

/**
 * Updates Discord roles for a player based on their current EXP level
 * @param player - The player whose roles need to be updated
 * @param logger - Logger instance for logging role changes
 * @returns Promise<void>
 */
export async function updatePlayerLevelRoles(player: Player, logger?: Logger): Promise<void> {
	try {
		const client = await resolveDependency(Client)
		const guild = client.guilds.cache.get(player.guild.id)

		if (!guild) {
			logger?.log(`Guild ${player.guild.id} not found for player ${player.dcTag}`, 'warn')

			return
		}

		const member = await guild.members.fetch(player.user.id).catch(() => null)
		if (!member) {
			logger?.log(`Member ${player.user.id} not found in guild ${player.guild.id}`, 'warn')

			return
		}

		await updateMemberLevelRoles(member, player.exp, logger)
	} catch (error) {
		logger?.log(`Failed to update roles for player ${player.dcTag}: ${error}`, 'error')
	}
}

/**
 * Updates Discord roles for a guild member based on their EXP level
 * @param member - The Discord guild member
 * @param currentExp - The player's current EXP
 * @param logger - Logger instance for logging role changes
 * @returns Promise<void>
 */
export async function updateMemberLevelRoles(member: GuildMember, currentExp: number, logger?: Logger): Promise<void> {
	const rolesToAdd: string[] = []
	const rolesToRemove: string[] = []

	// Determine which roles the player should have based on their EXP
	for (const [level, expRequired] of Object.entries(totalExpLevelMapping)) {
		if (currentExp >= expRequired) {
			rolesToAdd.push(levelRoleMapping[Number(level)])
		}
	}

	// Filter out undefined roles (levels that don't have role mappings)
	const validRolesToAdd = rolesToAdd.filter(roleId => roleId !== undefined)

	// Player should only have the highest level role, remove all lower ones
	if (validRolesToAdd.length > 1) {
		const highestRole = validRolesToAdd.pop()!
		rolesToRemove.push(...validRolesToAdd)
		validRolesToAdd.length = 0
		validRolesToAdd.push(highestRole)
	}

	// Special case: if player drops below level 10, remove level 10 role
	if (currentExp < totalExpLevelMapping[10]) {
		const level10Role = levelRoleMapping[10]
		if (level10Role && !rolesToRemove.includes(level10Role)) {
			rolesToRemove.push(level10Role)
		}
	}

	const roleManager = member.roles as GuildMemberRoleManager

	// Remove lower-tier roles
	await Promise.all(
		rolesToRemove.map(async (roleId) => {
			if (roleManager.cache.has(roleId)) {
				try {
					await roleManager.remove(roleId)
					logger?.log(`Role ${roleId} removed from user <@${member.id}> (EXP: ${currentExp})`, 'info')
				} catch (error) {
					logger?.log(`Failed to remove role ${roleId} from user <@${member.id}>: ${error}`, 'error')
				}
			}
		})
	)

	// Add appropriate level role
	await Promise.all(
		validRolesToAdd.map(async (roleId) => {
			if (!roleManager.cache.has(roleId)) {
				try {
					await roleManager.add(roleId)
					logger?.log(`Role ${roleId} added to user <@${member.id}> (EXP: ${currentExp})`, 'info')
				} catch (error) {
					logger?.log(`Failed to add role ${roleId} to user <@${member.id}>: ${error}`, 'error')
				}
			}
		})
	)

	// Special Y.Z. role (from user.ts)
	if (currentExp >= 4845) {
		try {
			await roleManager.add('1244319473834528879')
		} catch (error) {
			// Silently fail as in original code
		}
	}
}

/**
 * Gets the appropriate level role ID for a given EXP amount
 * @param exp - The player's EXP
 * @returns The role ID that should be assigned, or null if below level 10
 */
export function getLevelRoleForExp(exp: number): string | null {
	let appropriateLevel = 0

	for (const [level, expRequired] of Object.entries(totalExpLevelMapping)) {
		if (exp >= expRequired) {
			appropriateLevel = Number(level)
		}
	}

	return appropriateLevel >= 10 ? levelRoleMapping[appropriateLevel] : null
}
