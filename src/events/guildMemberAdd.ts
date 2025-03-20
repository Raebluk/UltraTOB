import { ArgsOf, Client } from 'discordx'

import { Discord, Injectable, On } from '@/decorators'
import { DailyCounter, Player } from '@/entities'
import { Database, Logger } from '@/services'
import { syncUser } from '@/utils/functions'

@Discord()
@Injectable()
export default class GuildMemberAddEvent {

	constructor(
		private logger: Logger,
		private db: Database
	) {}

	@On('guildMemberAdd')
	async guildCreateHandler(
		[member]: ArgsOf<'guildMemberAdd'>
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
