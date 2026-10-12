import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectsAndWorkflows1760200000000
  implements MigrationInterface
{
  name = 'CreateProjectsAndWorkflows1760200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" ("code", "description", "created_by", "updated_by")
      VALUES
        ('projects.read', 'View workspace projects', 'system', 'system'),
        ('projects.manage', 'Create, update, and delete workspace projects', 'system', 'system'),
        ('workflow.manage', 'Move projects through their workflow', 'system', 'system')
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      CROSS JOIN "permissions" permission
      WHERE role."name" = 'Owner'
        AND permission."code" IN ('projects.read', 'projects.manage', 'workflow.manage')
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      JOIN "permissions" permission
        ON permission."code" IN ('projects.read', 'projects.manage', 'workflow.manage')
      WHERE role."name" = 'Admin'
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      JOIN "permissions" permission ON permission."code" = 'projects.read'
      WHERE role."name" = 'Member'
    `);
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "key" character varying(10) NOT NULL,
        "description" text,
        "current_status_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_projects_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_projects_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_projects_workspace_key" UNIQUE ("workspace_id", "key")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "project_workflows" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL DEFAULT 'Default workflow',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_project_workflows_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_workflows_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_project_workflows_project" UNIQUE ("project_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "workflow_statuses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workflow_id" uuid NOT NULL,
        "key" character varying(30) NOT NULL,
        "name" character varying(100) NOT NULL,
        "position" integer NOT NULL,
        "is_initial" boolean NOT NULL DEFAULT false,
        "is_final" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_workflow_statuses_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workflow_statuses_workflow" FOREIGN KEY ("workflow_id")
          REFERENCES "project_workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_workflow_statuses_workflow_key" UNIQUE ("workflow_id", "key"),
        CONSTRAINT "UQ_workflow_statuses_workflow_position" UNIQUE ("workflow_id", "position")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_workflow_statuses_initial"
      ON "workflow_statuses" ("workflow_id") WHERE "is_initial" = true
    `);
    await queryRunner.query(`
      CREATE TABLE "workflow_transitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workflow_id" uuid NOT NULL,
        "from_status_id" uuid NOT NULL,
        "to_status_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_workflow_transitions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workflow_transitions_workflow" FOREIGN KEY ("workflow_id")
          REFERENCES "project_workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_workflow_transitions_from_status" FOREIGN KEY ("from_status_id")
          REFERENCES "workflow_statuses"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_workflow_transitions_to_status" FOREIGN KEY ("to_status_id")
          REFERENCES "workflow_statuses"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_workflow_transitions_path"
          UNIQUE ("workflow_id", "from_status_id", "to_status_id"),
        CONSTRAINT "CHK_workflow_transitions_distinct_statuses"
          CHECK ("from_status_id" <> "to_status_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "project_members" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_project_members_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_members_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_project_members_user" FOREIGN KEY ("user_id")
          REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_project_members_project_user" UNIQUE ("project_id", "user_id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD CONSTRAINT "FK_projects_current_status"
      FOREIGN KEY ("current_status_id") REFERENCES "workflow_statuses"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_projects_workspace" ON "projects" ("workspace_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_project_members_user" ON "project_members" ("user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "project_members"');
    await queryRunner.query('DROP TABLE "workflow_transitions"');
    await queryRunner.query(`
      ALTER TABLE "projects"
      DROP CONSTRAINT "FK_projects_current_status"
    `);
    await queryRunner.query('DROP TABLE "workflow_statuses"');
    await queryRunner.query('DROP TABLE "project_workflows"');
    await queryRunner.query('DROP TABLE "projects"');
    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "permission_id" IN (
        SELECT "id" FROM "permissions"
        WHERE "code" IN ('projects.read', 'projects.manage', 'workflow.manage')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "code" IN ('projects.read', 'projects.manage', 'workflow.manage')
    `);
  }
}
