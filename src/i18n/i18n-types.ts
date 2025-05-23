// This file was auto-generated by 'typesafe-i18n'. Any manual changes will be overwritten.
/* eslint-disable */
import type { BaseTranslation as BaseTranslationType, LocalizedString, RequiredParams } from 'typesafe-i18n'

export type BaseTranslation = BaseTranslationType
export type BaseLocale = 'en'

export type Locales =
	| 'en'

export type Translation = RootTranslation

export type Translations = RootTranslation

type RootTranslation = {
	GUARDS: {
		/**
		 * T​h​i​s​ ​c​o​m​m​a​n​d​ ​i​s​ ​c​u​r​r​e​n​t​l​y​ ​d​i​s​a​b​l​e​d​.
		 */
		DISABLED_COMMAND: string
		/**
		 * T​h​i​s​ ​b​o​t​ ​i​s​ ​c​u​r​r​e​n​t​l​y​ ​i​n​ ​m​a​i​n​t​e​n​a​n​c​e​ ​m​o​d​e​.
		 */
		MAINTENANCE: string
		/**
		 * T​h​i​s​ ​c​o​m​m​a​n​d​ ​c​a​n​ ​o​n​l​y​ ​b​e​ ​u​s​e​d​ ​i​n​ ​a​ ​s​e​r​v​e​r​.
		 */
		GUILD_ONLY: string
		/**
		 * T​h​i​s​ ​c​o​m​m​a​n​d​ ​c​a​n​ ​o​n​l​y​ ​b​e​ ​u​s​e​d​ ​i​n​ ​a​ ​N​S​F​W​ ​c​h​a​n​n​e​l​.
		 */
		NSFW: string
	}
	ERRORS: {
		/**
		 * A​n​ ​u​n​k​n​o​w​n​ ​e​r​r​o​r​ ​o​c​c​u​r​r​e​d​.
		 */
		UNKNOWN: string
	}
	SHARED: {
		/**
		 * N​o​ ​d​e​s​c​r​i​p​t​i​o​n​ ​p​r​o​v​i​d​e​d​.
		 */
		NO_COMMAND_DESCRIPTION: string
	}
	COMMANDS: {
		INVITE: {
			/**
			 * I​n​v​i​t​e​ ​t​h​e​ ​b​o​t​ ​t​o​ ​y​o​u​r​ ​s​e​r​v​e​r​!
			 */
			DESCRIPTION: string
			EMBED: {
				/**
				 * I​n​v​i​t​e​ ​m​e​ ​o​n​ ​y​o​u​r​ ​s​e​r​v​e​r​!
				 */
				TITLE: string
				/**
				 * [​C​l​i​c​k​ ​h​e​r​e​]​(​{​l​i​n​k​}​)​ ​t​o​ ​i​n​v​i​t​e​ ​m​e​!
				 * @param {unknown} link
				 */
				DESCRIPTION: RequiredParams<'link'>
			}
		}
		EXPMOD: {
			/**
			 * e​x​p​m​o​d
			 */
			NAME: string
			/**
			 * M​o​d​i​f​y​ ​e​x​p​ ​v​a​l​u​e​s​ ​f​o​r​ ​a​ ​s​p​e​c​i​f​i​e​d​ ​p​l​a​y​e​r
			 */
			DESCRIPTION: string
			OPTIONS: {
				AMOUNT: {
					/**
					 * a​m​o​u​n​t
					 */
					NAME: string
					/**
					 * T​h​e​ ​a​m​o​u​n​t​ ​t​o​ ​c​h​a​n​g​e​ ​(​p​o​s​i​t​i​v​e​ ​o​r​ ​n​e​g​a​t​i​v​e​)
					 */
					DESCRIPTION: string
				}
				TYPE: {
					/**
					 * t​y​p​e
					 */
					NAME: string
					/**
					 * "​e​x​p​"​ ​o​r​ ​"​s​i​l​v​e​r​"
					 */
					DESCRIPTION: string
				}
				DCTAG: {
					/**
					 * d​c​t​a​g
					 */
					NAME: string
					/**
					 * T​h​e​ ​p​l​a​y​e​r​'​s​ ​d​i​s​c​o​r​d​ ​t​a​g​ ​f​o​r​ ​r​e​f​e​r​e​n​c​e
					 */
					DESCRIPTION: string
				}
				DCTAGS: {
					/**
					 * d​c​t​a​g​s
					 */
					NAME: string
					/**
					 * T​h​e​ ​l​i​s​t​ ​o​f​ ​p​l​a​y​e​r​'​s​ ​d​i​s​c​o​r​d​ ​t​a​g​s
					 */
					DESCRIPTION: string
				}
				ROLETAG: {
					/**
					 * r​o​l​e​t​a​g
					 */
					NAME: string
					/**
					 * T​h​e​ ​I​D​ ​o​f​ ​r​o​l​e​s​ ​f​o​r​ ​r​e​f​e​r​e​n​c​e
					 */
					DESCRIPTION: string
				}
				NOTE: {
					/**
					 * n​o​t​e
					 */
					NAME: string
					/**
					 * R​e​a​s​o​n​ ​f​o​r​ ​t​h​e​ ​e​x​p​/​s​i​l​v​e​r​ ​m​o​d​i​f​i​c​a​t​i​o​n
					 */
					DESCRIPTION: string
				}
			}
		}
		CONFIG: {
			/**
			 * c​o​n​f​i​g
			 */
			NAME: string
			/**
			 * C​o​n​f​i​g​ ​s​e​r​v​e​r​-​b​a​s​e​d​ ​s​e​t​t​i​n​g​s
			 */
			DESCRIPTION: string
			OPTIONS: {
				NAME: {
					/**
					 * n​a​m​e
					 */
					NAME: string
					/**
					 * T​h​e​ ​n​a​m​e​ ​o​f​ ​t​h​e​ ​c​o​n​f​i​g​ ​i​t​e​m
					 */
					DESCRIPTION: string
				}
				TYPE: {
					/**
					 * t​y​p​e
					 */
					NAME: string
					/**
					 * "​c​h​a​n​n​e​l​"​ ​o​r​ ​"​r​o​l​e​"​ ​o​r​ ​"​u​s​e​r​"​ ​o​r​ ​"​m​i​s​s​i​o​n​"
					 */
					DESCRIPTION: string
				}
				VALUE: {
					/**
					 * v​a​l​u​e
					 */
					NAME: string
					/**
					 * T​h​e​ ​v​a​l​u​e​ ​o​f​ ​t​h​e​ ​c​o​n​f​i​g​ ​i​t​e​m
					 */
					DESCRIPTION: string
				}
				QUEST: {
					/**
					 * q​u​e​s​t​_​i​d
					 */
					NAME: string
					/**
					 * T​h​e​ ​q​u​e​s​t​ ​I​D
					 */
					DESCRIPTION: string
				}
				EMOJI: {
					/**
					 * e​m​o​j​i​_​i​d
					 */
					NAME: string
					/**
					 * T​h​e​ ​e​m​o​j​i​ ​I​D
					 */
					DESCRIPTION: string
				}
				REWARD: {
					/**
					 * r​e​w​a​r​d
					 */
					NAME: string
					/**
					 * T​h​e​ ​r​e​w​a​r​d​ ​a​m​o​u​n​t
					 */
					DESCRIPTION: string
				}
				REWARDTYPE: {
					/**
					 * r​e​w​a​r​d​_​t​y​p​e
					 */
					NAME: string
					/**
					 * T​h​e​ ​r​e​w​a​r​d​ ​t​y​p​e​,​ ​e​x​p​ ​o​r​ ​s​i​l​v​e​r
					 */
					DESCRIPTION: string
				}
				CHANNEL: {
					/**
					 * c​h​a​n​n​e​l​_​i​d
					 */
					NAME: string
					/**
					 * T​h​e​ ​c​h​a​n​n​e​l​ ​I​D​ ​t​h​a​t​ ​m​o​n​i​t​o​r​ ​t​h​e​ ​q​u​e​s​t
					 */
					DESCRIPTION: string
				}
			}
		}
		PREFIX: {
			/**
			 * p​r​e​f​i​x
			 */
			NAME: string
			/**
			 * C​h​a​n​g​e​ ​t​h​e​ ​p​r​e​f​i​x​ ​o​f​ ​t​h​e​ ​b​o​t​.
			 */
			DESCRIPTION: string
			OPTIONS: {
				PREFIX: {
					/**
					 * n​e​w​_​p​r​e​f​i​x
					 */
					NAME: string
					/**
					 * T​h​e​ ​n​e​w​ ​p​r​e​f​i​x​ ​o​f​ ​t​h​e​ ​b​o​t​.
					 */
					DESCRIPTION: string
				}
			}
			EMBED: {
				/**
				 * P​r​e​f​i​x​ ​c​h​a​n​g​e​d​ ​t​o​ ​`​{​p​r​e​f​i​x​}​`​.
				 * @param {string} prefix
				 */
				DESCRIPTION: RequiredParams<'prefix'>
			}
		}
		MAINTENANCE: {
			/**
			 * S​e​t​ ​t​h​e​ ​m​a​i​n​t​e​n​a​n​c​e​ ​m​o​d​e​ ​o​f​ ​t​h​e​ ​b​o​t​.
			 */
			DESCRIPTION: string
			EMBED: {
				/**
				 * M​a​i​n​t​e​n​a​n​c​e​ ​m​o​d​e​ ​s​e​t​ ​t​o​ ​`​{​s​t​a​t​e​}​`​.
				 * @param {string} state
				 */
				DESCRIPTION: RequiredParams<'state'>
			}
		}
		STATS: {
			/**
			 * G​e​t​ ​s​o​m​e​ ​s​t​a​t​s​ ​a​b​o​u​t​ ​t​h​e​ ​b​o​t​.
			 */
			DESCRIPTION: string
			HEADERS: {
				/**
				 * C​o​m​m​a​n​d​s
				 */
				COMMANDS: string
				/**
				 * G​u​i​l​d
				 */
				GUILDS: string
				/**
				 * A​c​t​i​v​e​ ​U​s​e​r​s
				 */
				ACTIVE_USERS: string
				/**
				 * U​s​e​r​s
				 */
				USERS: string
			}
		}
		HELP: {
			/**
			 * G​e​t​ ​g​l​o​b​a​l​ ​h​e​l​p​ ​a​b​o​u​t​ ​t​h​e​ ​b​o​t​ ​a​n​d​ ​i​t​s​ ​c​o​m​m​a​n​d​s
			 */
			DESCRIPTION: string
			EMBED: {
				/**
				 * H​e​l​p​ ​p​a​n​e​l
				 */
				TITLE: string
				/**
				 * {​c​a​t​e​g​o​r​y​}​ ​C​o​m​m​a​n​d​s
				 * @param {string} category
				 */
				CATEGORY_TITLE: RequiredParams<'category'>
			}
			SELECT_MENU: {
				/**
				 * S​e​l​e​c​t​ ​a​ ​c​a​t​e​g​o​r​y
				 */
				TITLE: string
				/**
				 * {​c​a​t​e​g​o​r​y​}​ ​c​o​m​m​a​n​d​s
				 * @param {string} category
				 */
				CATEGORY_DESCRIPTION: RequiredParams<'category'>
			}
		}
		PING: {
			/**
			 * P​o​n​g​!
			 */
			DESCRIPTION: string
			/**
			 * {​m​e​m​b​e​r​}​ ​P​o​n​g​!​ ​T​h​e​ ​m​e​s​s​a​g​e​ ​r​o​u​n​d​-​t​r​i​p​ ​t​o​o​k​ ​{​t​i​m​e​}​m​s​.​{​h​e​a​r​t​b​e​a​t​}
			 * @param {string} heartbeat
			 * @param {string} member
			 * @param {number} time
			 */
			MESSAGE: RequiredParams<'heartbeat' | 'member' | 'time'>
		}
	}
}

export type TranslationFunctions = {
	GUARDS: {
		/**
		 * This command is currently disabled.
		 */
		DISABLED_COMMAND: () => LocalizedString
		/**
		 * This bot is currently in maintenance mode.
		 */
		MAINTENANCE: () => LocalizedString
		/**
		 * This command can only be used in a server.
		 */
		GUILD_ONLY: () => LocalizedString
		/**
		 * This command can only be used in a NSFW channel.
		 */
		NSFW: () => LocalizedString
	}
	ERRORS: {
		/**
		 * An unknown error occurred.
		 */
		UNKNOWN: () => LocalizedString
	}
	SHARED: {
		/**
		 * No description provided.
		 */
		NO_COMMAND_DESCRIPTION: () => LocalizedString
	}
	COMMANDS: {
		INVITE: {
			/**
			 * Invite the bot to your server!
			 */
			DESCRIPTION: () => LocalizedString
			EMBED: {
				/**
				 * Invite me on your server!
				 */
				TITLE: () => LocalizedString
				/**
				 * [Click here]({link}) to invite me!
				 */
				DESCRIPTION: (arg: { link: unknown }) => LocalizedString
			}
		}
		EXPMOD: {
			/**
			 * expmod
			 */
			NAME: () => LocalizedString
			/**
			 * Modify exp values for a specified player
			 */
			DESCRIPTION: () => LocalizedString
			OPTIONS: {
				AMOUNT: {
					/**
					 * amount
					 */
					NAME: () => LocalizedString
					/**
					 * The amount to change (positive or negative)
					 */
					DESCRIPTION: () => LocalizedString
				}
				TYPE: {
					/**
					 * type
					 */
					NAME: () => LocalizedString
					/**
					 * "exp" or "silver"
					 */
					DESCRIPTION: () => LocalizedString
				}
				DCTAG: {
					/**
					 * dctag
					 */
					NAME: () => LocalizedString
					/**
					 * The player's discord tag for reference
					 */
					DESCRIPTION: () => LocalizedString
				}
				DCTAGS: {
					/**
					 * dctags
					 */
					NAME: () => LocalizedString
					/**
					 * The list of player's discord tags
					 */
					DESCRIPTION: () => LocalizedString
				}
				ROLETAG: {
					/**
					 * roletag
					 */
					NAME: () => LocalizedString
					/**
					 * The ID of roles for reference
					 */
					DESCRIPTION: () => LocalizedString
				}
				NOTE: {
					/**
					 * note
					 */
					NAME: () => LocalizedString
					/**
					 * Reason for the exp/silver modification
					 */
					DESCRIPTION: () => LocalizedString
				}
			}
		}
		CONFIG: {
			/**
			 * config
			 */
			NAME: () => LocalizedString
			/**
			 * Config server-based settings
			 */
			DESCRIPTION: () => LocalizedString
			OPTIONS: {
				NAME: {
					/**
					 * name
					 */
					NAME: () => LocalizedString
					/**
					 * The name of the config item
					 */
					DESCRIPTION: () => LocalizedString
				}
				TYPE: {
					/**
					 * type
					 */
					NAME: () => LocalizedString
					/**
					 * "channel" or "role" or "user" or "mission"
					 */
					DESCRIPTION: () => LocalizedString
				}
				VALUE: {
					/**
					 * value
					 */
					NAME: () => LocalizedString
					/**
					 * The value of the config item
					 */
					DESCRIPTION: () => LocalizedString
				}
				QUEST: {
					/**
					 * quest_id
					 */
					NAME: () => LocalizedString
					/**
					 * The quest ID
					 */
					DESCRIPTION: () => LocalizedString
				}
				EMOJI: {
					/**
					 * emoji_id
					 */
					NAME: () => LocalizedString
					/**
					 * The emoji ID
					 */
					DESCRIPTION: () => LocalizedString
				}
				REWARD: {
					/**
					 * reward
					 */
					NAME: () => LocalizedString
					/**
					 * The reward amount
					 */
					DESCRIPTION: () => LocalizedString
				}
				REWARDTYPE: {
					/**
					 * reward_type
					 */
					NAME: () => LocalizedString
					/**
					 * The reward type, exp or silver
					 */
					DESCRIPTION: () => LocalizedString
				}
				CHANNEL: {
					/**
					 * channel_id
					 */
					NAME: () => LocalizedString
					/**
					 * The channel ID that monitor the quest
					 */
					DESCRIPTION: () => LocalizedString
				}
			}
		}
		PREFIX: {
			/**
			 * prefix
			 */
			NAME: () => LocalizedString
			/**
			 * Change the prefix of the bot.
			 */
			DESCRIPTION: () => LocalizedString
			OPTIONS: {
				PREFIX: {
					/**
					 * new_prefix
					 */
					NAME: () => LocalizedString
					/**
					 * The new prefix of the bot.
					 */
					DESCRIPTION: () => LocalizedString
				}
			}
			EMBED: {
				/**
				 * Prefix changed to `{prefix}`.
				 */
				DESCRIPTION: (arg: { prefix: string }) => LocalizedString
			}
		}
		MAINTENANCE: {
			/**
			 * Set the maintenance mode of the bot.
			 */
			DESCRIPTION: () => LocalizedString
			EMBED: {
				/**
				 * Maintenance mode set to `{state}`.
				 */
				DESCRIPTION: (arg: { state: string }) => LocalizedString
			}
		}
		STATS: {
			/**
			 * Get some stats about the bot.
			 */
			DESCRIPTION: () => LocalizedString
			HEADERS: {
				/**
				 * Commands
				 */
				COMMANDS: () => LocalizedString
				/**
				 * Guild
				 */
				GUILDS: () => LocalizedString
				/**
				 * Active Users
				 */
				ACTIVE_USERS: () => LocalizedString
				/**
				 * Users
				 */
				USERS: () => LocalizedString
			}
		}
		HELP: {
			/**
			 * Get global help about the bot and its commands
			 */
			DESCRIPTION: () => LocalizedString
			EMBED: {
				/**
				 * Help panel
				 */
				TITLE: () => LocalizedString
				/**
				 * {category} Commands
				 */
				CATEGORY_TITLE: (arg: { category: string }) => LocalizedString
			}
			SELECT_MENU: {
				/**
				 * Select a category
				 */
				TITLE: () => LocalizedString
				/**
				 * {category} commands
				 */
				CATEGORY_DESCRIPTION: (arg: { category: string }) => LocalizedString
			}
		}
		PING: {
			/**
			 * Pong!
			 */
			DESCRIPTION: () => LocalizedString
			/**
			 * {member} Pong! The message round-trip took {time}ms.{heartbeat}
			 */
			MESSAGE: (arg: { heartbeat: string, member: string, time: number }) => LocalizedString
		}
	}
}

export type Formatters = {}
