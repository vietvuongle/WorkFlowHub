import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableUuidOssp1720105653063 implements MigrationInterface {
  name = 'EnableUuidOssp1720105653063';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  }

  public async down(): Promise<void> {}
}
