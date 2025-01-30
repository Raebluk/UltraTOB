import { env } from '@/env'

export const generalConfig: GeneralConfigType = {

	name: 'ultra-tob', // the name of your bot
	description: '', // the description of your bot
	defaultLocale: 'en', // default language of the bot, must be a valid locale
	ownerId: env.BOT_OWNER_ID,
	botId: env.BOT_ID,
	timezone: 'America/New_York', // default TimeZone set to New York time to well format and localize dates (logs, stats, etc)

	simpleCommandsPrefix: '!', // default prefix for simple command messages (old way to do commands on discord)
	automaticDeferring: false, // enable or not the automatic deferring of the replies of the bot on the command interactions

	// useful links
	links: {
		invite: 'https://www.change_invite_link_here.com',
		supportServer: 'https://discord.com/your_invitation_link',
		gitRemoteRepo: 'https://github.com/raebluk/',
	},

	automaticUploadImagesToImgur: false, // enable or not the automatic assets upload

	devs: [], // discord IDs of the devs that are working on the bot (you don't have to put the owner's id here)

	// define the bot activities (phrases under its name). Types can be: PLAYING, LISTENING, WATCHING, STREAMING
	activities: [
		{
			text: 'tscord',
			type: 'PLAYING',
		},
		{
			text: 'with tscord',
			type: 'STREAMING',
		},
	],

}

export const playerConfig = {
	expDoubleLimit: 5300, // the limit of exp to double the daily exp
}

// TODO: move to db
export const yzConfig = {
	channels: {
		userCommandAllowed: ['1335948089768415357'],
	},
	roles: {
		playerQualifiedRequired: ['1217468916540903484', '1215766168674238524'],
	},
}

// global colors
export const colorsConfig = {
	primary: '#2F3136',
	success: '#43B581',
	error: '#F04747',
	warn: '#FAA61A',
	info: '#7289DA',
}
