type DatabaseSize = {
	db: number | null
	backups: number | null
}

// type DatabaseConfigs = {
// 	sqlite: {
// 		driver: import('@mikro-orm/sqlite').SqliteDriver
// 		entityManager: import('@mikro-orm/sqlite').SqlEntityManager
// 	}
// 	postgresql: {
// 		driver: import('@mikro-orm/postgresql').PostgreSqlDriver
// 		entityManager: import('@mikro-orm/postgresql').SqlEntityManager
// 	}
// }

type DatabaseDriver = import('@mikro-orm/postgresql').PostgreSqlDriver
type DatabaseEntityManager = import('@mikro-orm/postgresql').SqlEntityManager