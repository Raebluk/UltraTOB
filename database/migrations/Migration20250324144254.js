'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const { Migration } = require('@mikro-orm/migrations')

class Migration20250324144254 extends Migration {

	async up() {
		this.addSql(`create table "guild_config_item" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "guild_id" varchar(255) not null, "value" varchar(255) not null default '', "type" varchar(255) not null);`)

		this.addSql(`create table "message" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "channel" varchar(255) not null, "value" varchar(255) not null default '', constraint "message_pkey" primary key ("id"));`)

		this.addSql(`alter table "guild_config_item" add constraint "guild_config_item_guild_id_foreign" foreign key ("guild_id") references "guild" ("id") on update cascade;`)
	}

	async down() {
		this.addSql(`drop table if exists "guild_config_item" cascade;`)

		this.addSql(`drop table if exists "message" cascade;`)
	}

}
exports.Migration20250324144254 = Migration20250324144254
