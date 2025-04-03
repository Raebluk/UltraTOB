'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const { Migration } = require('@mikro-orm/migrations')

class Migration20250311094053 extends Migration {

	async up() {
		this.addSql(`create table "data" ("key" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "value" varchar(255) not null default '', constraint "data_pkey" primary key ("key"));`)

		this.addSql(`create table "guild" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "prefix" varchar(255) null, "deleted" boolean not null default false, "last_interact" timestamptz not null, constraint "guild_pkey" primary key ("id"));`)

		this.addSql(`create table "image" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "file_name" varchar(255) not null, "base_path" varchar(255) not null default '', "url" varchar(255) not null, "size" int not null, "tags" text[] not null, "hash" varchar(255) not null, "delete_hash" varchar(255) not null);`)

		this.addSql(`create table "pastebin" ("id" varchar(255) not null, "edit_code" varchar(255) not null, "lifetime" int not null default -1, "created_at" timestamptz not null, constraint "pastebin_pkey" primary key ("id"));`)

		this.addSql(`create table "stat" ("id" serial primary key, "type" varchar(255) not null, "value" varchar(255) not null default '', "additional_data" jsonb null, "created_at" timestamptz not null);`)

		this.addSql(`create table "user" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "last_interact" timestamptz not null, constraint "user_pkey" primary key ("id"));`)

		this.addSql(`create table "player" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "guild_id" varchar(255) not null, "dc_tag" varchar(255) not null, "exp" int not null default 0, "sliver" int not null default 0, constraint "player_pkey" primary key ("id"));`)

		this.addSql(`create table "quest" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "publisher_id" varchar(255) not null, "guild_id" varchar(255) not null, "reviewer_id" varchar(255) not null, "name" varchar(255) not null, "description" varchar(255) not null, "multiple_takers" boolean not null default true, "repeatable" boolean not null default true, "reward_description" varchar(255) not null, "expire_date" timestamptz not null, "review_date" timestamptz not null, "approve_date" timestamptz not null, "published_by_admin" boolean not null default false, constraint "quest_pkey" primary key ("id"));`)

		this.addSql(`create table "quest_record" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "quest_id" varchar(255) not null, "taker_id" varchar(255) not null, "reviewer_id" varchar(255) null, "need_review" boolean not null default false, "complete_date" timestamptz null, "fail_date" timestamptz null, "quest_ended" boolean not null default false);`)

		this.addSql(`create table "daily_counter" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "player_id" varchar(255) not null, "player_dc_tag" varchar(255) not null, "chat_exp" int not null default 10, "voice_exp" int not null default 90);`)

		this.addSql(`create table "value_change_log" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "player_id" varchar(255) not null, "player_dc_tag" varchar(255) not null, "amount" int not null, "type" varchar(255) not null, "note" varchar(255) not null, "moderator_id" varchar(255) not null);`)

		this.addSql(`alter table "player" add constraint "player_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`)
		this.addSql(`alter table "player" add constraint "player_guild_id_foreign" foreign key ("guild_id") references "guild" ("id") on update cascade;`)

		this.addSql(`alter table "quest" add constraint "quest_publisher_id_foreign" foreign key ("publisher_id") references "player" ("id") on update cascade;`)
		this.addSql(`alter table "quest" add constraint "quest_guild_id_foreign" foreign key ("guild_id") references "guild" ("id") on update cascade;`)
		this.addSql(`alter table "quest" add constraint "quest_reviewer_id_foreign" foreign key ("reviewer_id") references "player" ("id") on update cascade;`)

		this.addSql(`alter table "quest_record" add constraint "quest_record_quest_id_foreign" foreign key ("quest_id") references "quest" ("id") on update cascade;`)
		this.addSql(`alter table "quest_record" add constraint "quest_record_taker_id_foreign" foreign key ("taker_id") references "player" ("id") on update cascade;`)
		this.addSql(`alter table "quest_record" add constraint "quest_record_reviewer_id_foreign" foreign key ("reviewer_id") references "player" ("id") on update cascade on delete set null;`)

		this.addSql(`alter table "daily_counter" add constraint "daily_counter_player_id_foreign" foreign key ("player_id") references "player" ("id") on update cascade;`)

		this.addSql(`alter table "value_change_log" add constraint "value_change_log_player_id_foreign" foreign key ("player_id") references "player" ("id") on update cascade;`)
		this.addSql(`alter table "value_change_log" add constraint "value_change_log_moderator_id_foreign" foreign key ("moderator_id") references "user" ("id") on update cascade;`)
	}

}
exports.Migration20250311094053 = Migration20250311094053
