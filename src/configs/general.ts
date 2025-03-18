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
	expDoubleLimit: 6305, // the limit of exp to double the daily exp
	totalExpLevelMapping: {
		5: 90,
		10: 425,
		15: 1680,
		20: 6305,
		25: 19675,
		30: 34675,
		35: 49675,
		40: 64675,
		45: 79675,
		50: 94675,
	},
}

// TODO: move to db
export const yzConfig = {
	channels: {
		userCommandAllowed: ['1348488218873692211'],
		missionBroadcastChannel: '1348487926689829011',
		modLogChannel: '1348488104662667284',
	},
	roles: {
		playerQualifiedRequired: ['1217468916540903484', '1215766168674238524'],
		levelRoleMapping: {
			10: '1337585523887177813',
			15: '1351008487571980381',
			20: '1351007105355747390',
			25: '1351007307277926511',
			30: '1351009018918735923',
			35: '1351009016590897183',
			40: '1351009009393598475',
			45: '1351009014506586183',
			50: '1351009012228947968',
		},
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
