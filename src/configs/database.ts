import { Options } from '@mikro-orm/core'
import { EntityGenerator } from '@mikro-orm/entity-generator'
import { Migrator } from '@mikro-orm/migrations'
import { PostgreSqlDriver } from '@mikro-orm/postgresql'
import { SqlHighlighter } from '@mikro-orm/sql-highlighter'

// import { SqliteDriver } from '@mikro-orm/sqlite'
// eslint-disable-next-line unused-imports/no-unused-imports
import { env } from '@/env'

type Config = {
	production: Options
	development?: Options
}

export const databaseConfig: DatabaseConfigType = {

	path: './database/', // path to the folder containing the migrations and SQLite database (if used)

	// config for setting up an automated backup of the database (ONLY FOR SQLITE)
	backup: {
		enabled: false,
		path: './database/backups/', // path to the backups folder (should be in the database/ folder)
	},
}

const envMikroORMConfig = {

	production: {

		/**
		 * SQLite
		 */
		// driver: SqliteDriver,
		// dbName: `${databaseConfig.path}db.sqlite`,

		/**
		 * MongoDB
		 */
		// driver: MongoDriver,
		// clientUrl: env['DATABASE_HOST'],

		/**
		 * PostgreSQL
		 */
		driver: PostgreSqlDriver,
		dbName: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		port: Number(env.DATABASE_PORT),
		user: env.DATABASE_USER,
		password: env.DATABASE_PASSWORD,

		/**
		 * MySQL
		 */
		// driver: MySqlDriver,
		// dbName: env.DATABASE_NAME,
		// host: env.DATABASE_HOST,
		// port: Number(env.DATABASE_PORT),
		// user: env.DATABASE_USER,
		// password: env.DATABASE_PASSWORD,

		/**
		 * MariaDB
		 */
		// driver: MariaDbDriver,
		// dbName: env.DATABASE_NAME,
		// host: env.DATABASE_HOST,
		// port: Number(env.DATABASE_PORT),
		// user: env.DATABASE_USER,
		// password: env.DATABASE_PASSWORD,

		highlighter: new SqlHighlighter(),
		debug: false,

		migrations: {
			path: './database/migrations',
			emit: 'js',
			snapshot: true,
		},

		extensions: [
			Migrator,
			EntityGenerator,
		],
	},

	development: {

	},

} satisfies Config

if (!envMikroORMConfig.development || Object.keys(envMikroORMConfig.development).length === 0)
	envMikroORMConfig.development = envMikroORMConfig.production

export const mikroORMConfig = envMikroORMConfig as {
	production: typeof envMikroORMConfig['production']
	development: typeof envMikroORMConfig['production']
}
