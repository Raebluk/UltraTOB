/* eslint-disable */
import type { BaseTranslation } from '../i18n-types'

const en = {
	GUARDS: {
		DISABLED_COMMAND: 'This command is currently disabled.',
		MAINTENANCE: 'This bot is currently in maintenance mode.',
		GUILD_ONLY: 'This command can only be used in a server.',
		NSFW: 'This command can only be used in a NSFW channel.',
	},
	ERRORS: {
		UNKNOWN: 'An unknown error occurred.',
	},
	SHARED: {
		NO_COMMAND_DESCRIPTION: 'No description provided.',
	},
	COMMANDS: {
		INVITE: {
			DESCRIPTION: 'Invite the bot to your server!',
			EMBED: {
				TITLE: 'Invite me on your server!',
				DESCRIPTION: '[Click here]({link}) to invite me!',
			},
		},
		EXPMOD: {
			NAME: 'expmod',
			DESCRIPTION: 'Modify exp values for a specified player',
			OPTIONS: {
				AMOUNT: {
					NAME: 'amount',
					DESCRIPTION: 'The amount to change (positive or negative)',
				},
				TYPE: {
					NAME: 'type',
					DESCRIPTION: '"exp" or "silver"',
				},
				DCTAG: {
					NAME: 'dctag',
					DESCRIPTION: "The player's discord tag for reference",
				},
				DCTAGS: {
					NAME: 'dctags',
					DESCRIPTION: "The list of player's discord tags",
				},
				ROLETAG: {
					NAME: 'roletag',
					DESCRIPTION: 'The ID of roles for reference',
				},
				NOTE: {
					NAME: 'note',
					DESCRIPTION: 'Reason for the exp/silver modification',
				},
			},
		},
		CONFIG: {
			NAME: 'config',
			DESCRIPTION: 'Config server-based settings',
			OPTIONS: {
				NAME: {
					NAME: 'name',
					DESCRIPTION: 'The name of the config item',
				},
				TYPE: {
					NAME: 'type',
					DESCRIPTION: '"channel" or "role" or "user" or "mission"',
				},
				VALUE: {
					NAME: 'value',
					DESCRIPTION: 'The value of the config item',
				},
				QUEST: {
					NAME: 'quest_id',
					DESCRIPTION: 'The quest ID',
				},
				EMOJI: {
					NAME: 'emoji_id',
					DESCRIPTION: 'The emoji ID',
				},
				REWARD: {
					NAME: 'reward',
					DESCRIPTION: 'The reward amount',
				},
				REWARDTYPE: {
					NAME: 'reward_type',
					DESCRIPTION: 'The reward type, exp or silver',
				},
				CHANNEL: {
					NAME: 'channel_id',
					DESCRIPTION: 'The channel ID that monitor the quest',
				},
			},
		},
		PREFIX: {
			NAME: 'prefix',
			DESCRIPTION: 'Change the prefix of the bot.',
			OPTIONS: {
				PREFIX: {
					NAME: 'new_prefix',
					DESCRIPTION: 'The new prefix of the bot.',
				},
			},
			EMBED: {
				DESCRIPTION: 'Prefix changed to `{prefix:string}`.',
			},
		},
		MAINTENANCE: {
			DESCRIPTION: 'Set the maintenance mode of the bot.',
			EMBED: {
				DESCRIPTION: 'Maintenance mode set to `{state:string}`.',
			},
		},
		STATS: {
			DESCRIPTION: 'Get some stats about the bot.',
			HEADERS: {
				COMMANDS: 'Commands',
				GUILDS: 'Guild',
				ACTIVE_USERS: 'Active Users',
				USERS: 'Users',
			},
		},
		HELP: {
			DESCRIPTION: 'Get global help about the bot and its commands',
			EMBED: {
				TITLE: 'Help panel',
				CATEGORY_TITLE: '{category:string} Commands',
			},
			SELECT_MENU: {
				TITLE: 'Select a category',
				CATEGORY_DESCRIPTION: '{category:string} commands',
			},
		},
		PING: {
			DESCRIPTION: 'Pong!',
			MESSAGE: '{member:string} Pong! The message round-trip took {time:number}ms.{heartbeat:string}',
		},
	},
} satisfies BaseTranslation

export default en
