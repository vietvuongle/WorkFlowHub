import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTasksAndWorkLogs1760300000000 implements MigrationInterface {
  name = 'CreateTasksAndWorkLogs1760300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "next_task_number" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "number" integer NOT NULL,
        "key" character varying(30) NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "estimate_minutes" integer NOT NULL,
        "logged_minutes" integer NOT NULL DEFAULT 0,
        "remaining_minutes" integer NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'TODO',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_tasks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tasks_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_tasks_project_number" UNIQUE ("project_id", "number"),
        CONSTRAINT "UQ_tasks_project_key" UNIQUE ("project_id", "key"),
        CONSTRAINT "CHK_tasks_estimate_positive" CHECK ("estimate_minutes" > 0),
        CONSTRAINT "CHK_tasks_logged_nonnegative" CHECK ("logged_minutes" >= 0),
        CONSTRAINT "CHK_tasks_remaining_nonnegative" CHECK ("remaining_minutes" >= 0),
        CONSTRAINT "CHK_tasks_status"
          CHECK ("status" IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_project_status" ON "tasks" ("project_id", "status")
    `);
    await queryRunner.query(`
      CREATE TABLE "task_work_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "work_date" date NOT NULL,
        "duration_minutes" integer NOT NULL,
        "description" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_task_work_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_work_logs_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_task_work_logs_user" FOREIGN KEY ("user_id")
          REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_task_work_logs_duration_positive"
          CHECK ("duration_minutes" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_task_work_logs_task_date"
      ON "task_work_logs" ("task_id", "work_date")
    `);
    await queryRunner.query(`
      INSERT INTO "permissions" ("code", "description", "created_by", "updated_by")
      VALUES
        ('tasks.read', 'View tasks in workspace projects', 'system', 'system'),
        ('tasks.manage', 'Create and manage project tasks and work logs', 'system', 'system')
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      CROSS JOIN "permissions" permission
      WHERE role."name" IN ('Owner', 'Admin', 'Member')
        AND permission."code" IN ('tasks.read', 'tasks.manage')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "permission_id" IN (
        SELECT "id" FROM "permissions" WHERE "code" IN ('tasks.read', 'tasks.manage')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "code" IN ('tasks.read', 'tasks.manage')
    `);
    await queryRunner.query('DROP TABLE "task_work_logs"');
    await queryRunner.query('DROP TABLE "tasks"');
    await queryRunner.query(
      'ALTER TABLE "projects" DROP COLUMN "next_task_number"',
    );
  }
}
