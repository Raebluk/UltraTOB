'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const { Migration } = require('@mikro-orm/migrations')

class Migration20250930000000 extends Migration {

	async up() {
		// Create player_metadata table
		this.addSql(`create table "player_metadata" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "guild_id" varchar(255) not null, "init_silver_given" boolean not null default false, constraint "player_metadata_pkey" primary key ("id"));`)

		// Add foreign key constraints
		this.addSql(`alter table "player_metadata" add constraint "player_metadata_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`)
		this.addSql(`alter table "player_metadata" add constraint "player_metadata_guild_id_foreign" foreign key ("guild_id") references "guild" ("id") on update cascade;`)

		// Add unique constraint for user-guild combination
		this.addSql(`alter table "player_metadata" add constraint "player_metadata_user_guild_unique" unique ("user_id", "guild_id");`)
	}

	async down() {
		// Drop player_metadata table
		this.addSql(`drop table if exists "player_metadata" cascade;`)
	}

}
exports.Migration20250930000000 = Migration20250930000000
