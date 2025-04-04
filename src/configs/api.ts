import 'dotenv/config'

import process from 'node:process'

const env = process.env

export const apiConfig: APIConfigType = {

	enabled: false, // is the API server enabled or not
	port: env.API_PORT as any || 4000, // very bad type casting ;(
}