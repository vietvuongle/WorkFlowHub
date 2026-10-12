import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkspacesTable1760000000000 implements MigrationInterface {
  name = 'CreateWorkspacesTable1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "workspaces" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "slug" character varying(255) NOT NULL,
        "description" text,
        "owner_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_workspaces_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspaces_owner" FOREIGN KEY ("owner_id")
          REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_workspaces_slug" ON "workspaces" ("slug")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_workspaces_owner_id" ON "workspaces" ("owner_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "workspaces"');
  }
}
