import { Guild as DGuild, User as DUser } from 'discord.js'
import { ArgsOf, Client } from 'discordx'

import { generalConfig, playerConfig } from '@/configs'
import { Discord, Injectable, On, Schedule } from '@/decorators'
import { DailyCounter, Player, User, ValueChangeLog } from '@/entities'
import { Database, Logger } from '@/services'
import { syncGuild, syncUser } from '@/utils/functions'

@Discord()
@Injectable()
export default class GuildMemberAddEvent {

	constructor(
		private logger: Logger,
		private db: Database
	) {}

	@On('guildMemberAdd')
	async guildCreateHandler(
		[member]: ArgsOf<'guildMemberAdd'>,
		client: Client
	) {
		const guild = member.guild
		const existingPlayer = await this.db.get(Player).findOne({ id: `${member.user.id}-${guild.id}` })
		if (!existingPlayer) {
			await syncUser(member.user)
			const player = await this.db.get(Player).addPlayer(member.user, guild).catch()
			await this.db.get(DailyCounter).initCounter(player)
		}
	}

}
