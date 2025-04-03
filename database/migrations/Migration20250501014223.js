'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const { Migration } = require('@mikro-orm/migrations');
class Migration20250501014223 extends Migration {

  async up() {
    this.addSql(`alter table "player" rename column "sliver" to "silver";`);

    this.addSql(`alter table "quest_record" add column "record_note" varchar(255) not null default '';`);

    this.addSql(`alter table "daily_counter" add column "daily_mission_exp" int not null default 100;`);
  }

  async down() {
    this.addSql(`alter table "player" rename column "silver" to "sliver";`);

    this.addSql(`alter table "quest_record" drop column "record_note";`);

    this.addSql(`alter table "daily_counter" drop column "daily_mission_exp";`);
  }

}
exports.Migration20250501014223 = Migration20250501014223;
