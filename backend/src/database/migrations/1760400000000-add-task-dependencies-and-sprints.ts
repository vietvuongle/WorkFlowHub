import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskDependenciesAndSprints1760400000000
  implements MigrationInterface
{
  name = 'AddTaskDependenciesAndSprints1760400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sprints" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "goal" text,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'PLANNED',
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_sprints_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sprints_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_sprints_date_range" CHECK ("end_date" >= "start_date"),
        CONSTRAINT "CHK_sprints_status"
          CHECK ("status" IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sprints_project_start_date"
      ON "sprints" ("project_id", "start_date")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_sprints_one_active_per_project"
      ON "sprints" ("project_id") WHERE "status" = 'ACTIVE'
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "parent_task_id" uuid,
      ADD COLUMN "sprint_id" uuid,
      ADD CONSTRAINT "FK_tasks_parent_task"
        FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION,
      ADD CONSTRAINT "FK_tasks_sprint"
        FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION,
      ADD CONSTRAINT "CHK_tasks_not_own_parent"
        CHECK ("parent_task_id" IS NULL OR "parent_task_id" <> "id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_parent_task" ON "tasks" ("parent_task_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_sprint" ON "tasks" ("sprint_id")
    `);
    await queryRunner.query(`
      CREATE TABLE "task_dependencies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "task_id" uuid NOT NULL,
        "depends_on_task_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_task_dependencies_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_dependencies_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_task_dependencies_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_task_dependencies_depends_on" FOREIGN KEY ("depends_on_task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_task_dependencies_path"
          UNIQUE ("task_id", "depends_on_task_id"),
        CONSTRAINT "CHK_task_dependencies_distinct_tasks"
          CHECK ("task_id" <> "depends_on_task_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_task_dependencies_project"
      ON "task_dependencies" ("project_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "task_dependencies"');
    await queryRunner.query('DROP INDEX "IDX_tasks_sprint"');
    await queryRunner.query('DROP INDEX "IDX_tasks_parent_task"');
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP CONSTRAINT "CHK_tasks_not_own_parent",
      DROP CONSTRAINT "FK_tasks_sprint",
      DROP CONSTRAINT "FK_tasks_parent_task",
      DROP COLUMN "sprint_id",
      DROP COLUMN "parent_task_id"
    `);
    await queryRunner.query('DROP TABLE "sprints"');
  }
}
