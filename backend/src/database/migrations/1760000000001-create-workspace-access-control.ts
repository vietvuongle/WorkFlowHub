import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkspaceAccessControl1760000000001
  implements MigrationInterface
{
  name = 'CreateWorkspaceAccessControl1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(100) NOT NULL,
        "description" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_permissions_code" ON "permissions" ("code")',
    );
    await queryRunner.query(`
      INSERT INTO "permissions" (
        "code", "description", "created_by", "updated_by"
      ) VALUES
        ('workspace.read', 'View workspace details', 'system', 'system'),
        ('workspace.update', 'Update workspace details', 'system', 'system'),
        ('workspace.delete', 'Delete the workspace', 'system', 'system'),
        ('members.read', 'View workspace members', 'system', 'system'),
        ('members.manage', 'Add members and change their roles or status', 'system', 'system'),
        ('roles.read', 'View workspace roles and permissions', 'system', 'system'),
        ('roles.manage', 'Create and update custom workspace roles', 'system', 'system')
    `);
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_roles_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_roles_workspace_name" UNIQUE ("workspace_id", "name")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("role_id")
          REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permission_id")
          REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "workspace_members" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE'
          CHECK ("status" IN ('INVITED', 'ACTIVE', 'SUSPENDED')),
        "joined_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_workspace_members_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_members_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_workspace_members_user" FOREIGN KEY ("user_id")
          REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_workspace_members_role" FOREIGN KEY ("role_id")
          REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "UQ_workspace_members_workspace_user" UNIQUE ("workspace_id", "user_id")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "roles" (
        "workspace_id", "name", "description", "is_system",
        "created_by", "updated_by"
      )
      SELECT "id", 'Owner', 'Workspace owner with full access', true, "owner_id"::text, "owner_id"::text
      FROM "workspaces"
    `);
    await queryRunner.query(`
      INSERT INTO "roles" (
        "workspace_id", "name", "description", "is_system",
        "created_by", "updated_by"
      )
      SELECT "id", 'Admin', 'Workspace administrator', true, "owner_id"::text, "owner_id"::text
      FROM "workspaces"
    `);
    await queryRunner.query(`
      INSERT INTO "roles" (
        "workspace_id", "name", "description", "is_system",
        "created_by", "updated_by"
      )
      SELECT "id", 'Member', 'Standard workspace member', true, "owner_id"::text, "owner_id"::text
      FROM "workspaces"
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      CROSS JOIN "permissions" permission
      WHERE role."name" = 'Owner'
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      JOIN "permissions" permission
        ON permission."code" IN (
          'workspace.read', 'workspace.update',
          'members.read', 'members.manage', 'roles.read'
        )
      WHERE role."name" = 'Admin'
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT role."id", permission."id"
      FROM "roles" role
      JOIN "permissions" permission ON permission."code" IN (
        'workspace.read', 'members.read', 'roles.read'
      )
      WHERE role."name" = 'Member'
    `);
    await queryRunner.query(`
      INSERT INTO "workspace_members" (
        "workspace_id", "user_id", "role_id", "status", "joined_at",
        "created_by", "updated_by"
      )
      SELECT workspace."id", workspace."owner_id", role."id", 'ACTIVE',
        CURRENT_TIMESTAMP, workspace."owner_id"::text, workspace."owner_id"::text
      FROM "workspaces" workspace
      JOIN "roles" role
        ON role."workspace_id" = workspace."id" AND role."name" = 'Owner'
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_workspace_members_user_status" ON "workspace_members" ("user_id", "status")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "workspace_members"');
    await queryRunner.query('DROP TABLE "role_permissions"');
    await queryRunner.query('DROP TABLE "roles"');
    await queryRunner.query('DROP TABLE "permissions"');
  }
}
