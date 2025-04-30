'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const { Migration } = require('@mikro-orm/migrations');

class Migration20250912100711 extends Migration {

  async up() {
    // Create draw_reward table
    this.addSql(`create table "draw_reward" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "type" varchar(255) not null, "value" int not null default 0, "probability" int not null, "enabled" boolean not null default true);`);

    // Create draw_history table
    this.addSql(`create table "draw_history" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "player_id" varchar(255) not null, "reward_id" int not null, "draw_date" timestamptz not null);`);

    // Add foreign key constraints
    this.addSql(`alter table "draw_history" add constraint "draw_history_player_id_foreign" foreign key ("player_id") references "player" ("id") on update cascade;`);
    this.addSql(`alter table "draw_history" add constraint "draw_history_reward_id_foreign" foreign key ("reward_id") references "draw_reward" ("id") on update cascade;`);
  }

  async down() {
    // Drop tables in reverse order (drop dependent table first)
    this.addSql(`drop table if exists "draw_history" cascade;`);
    this.addSql(`drop table if exists "draw_reward" cascade;`);
  }

}
exports.Migration20250912100711 = Migration20250912100711;

