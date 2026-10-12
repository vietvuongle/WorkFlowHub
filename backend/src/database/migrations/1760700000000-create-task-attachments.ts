import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskAttachments1760700000000 implements MigrationInterface {
  name = 'CreateTaskAttachments1760700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "task_attachments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "public_id" character varying(255) NOT NULL,
        "resource_type" character varying(10) NOT NULL,
        "original_filename" character varying(255) NOT NULL,
        "content_type" character varying(100) NOT NULL,
        "size_bytes" integer,
        "format" character varying(20),
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_task_attachments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_attachments_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_task_attachments_resource_type"
          CHECK ("resource_type" IN ('image', 'raw')),
        CONSTRAINT "CHK_task_attachments_status"
          CHECK ("status" IN ('PENDING', 'ACTIVE')),
        CONSTRAINT "CHK_task_attachments_size"
          CHECK ("size_bytes" IS NULL OR "size_bytes" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_task_attachments_public_id"
      ON "task_attachments" ("public_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_task_attachments_task_status"
      ON "task_attachments" ("task_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "task_attachments"');
  }
}
