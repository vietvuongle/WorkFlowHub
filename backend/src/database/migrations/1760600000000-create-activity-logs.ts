import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateActivityLogs1760600000000 implements MigrationInterface {
  name = 'CreateActivityLogs1760600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activity_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "project_id" uuid,
        "task_id" uuid,
        "entity_type" character varying(50) NOT NULL,
        "entity_id" uuid NOT NULL,
        "action" character varying(20) NOT NULL,
        "actor_id" character varying(100) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_activity_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_activity_logs_action"
          CHECK ("action" IN ('created', 'updated', 'deleted'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_activity_logs_workspace_created"
      ON "activity_logs" ("workspace_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_activity_logs_project_created"
      ON "activity_logs" ("project_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_activity_logs_task_created"
      ON "activity_logs" ("task_id", "created_at")
    `);
    await queryRunner.query(`
      INSERT INTO "permissions" ("code", "description", "created_by", "updated_by")
      VALUES ('activity.read', 'View workspace activity history', 'system', 'system')
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      CROSS JOIN "permissions" permission
      WHERE permission."code" = 'activity.read'
        AND role."name" IN ('Owner', 'Admin', 'Member')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "permission_id" = (
        SELECT "id" FROM "permissions" WHERE "code" = 'activity.read'
      )
    `);
    await queryRunner.query(
      'DELETE FROM "permissions" WHERE "code" = \'activity.read\'',
    );
    await queryRunner.query('DROP TABLE "activity_logs"');
  }
}
