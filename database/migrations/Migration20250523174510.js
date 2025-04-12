'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const { Migration } = require('@mikro-orm/migrations');

class Migration20250523174510 extends Migration {

  async up() {
    this.addSql(`alter table "quest" add column "manual" boolean not null default false;`);
  }

  async down() {
    this.addSql(`alter table "quest" drop column "manual";`);
  }

}
exports.Migration20250523174510 = Migration20250523174510;
