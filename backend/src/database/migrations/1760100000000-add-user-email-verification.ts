import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserEmailVerification1760100000000
  implements MigrationInterface
{
  name = 'AddUserEmailVerification1760100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN "is_email_verified" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      UPDATE "user" SET "is_email_verified" = true
    `);
    await queryRunner.query(`
      ALTER TABLE "user"
      ALTER COLUMN "is_email_verified" SET DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user" DROP COLUMN "is_email_verified"
    `);
  }
}
