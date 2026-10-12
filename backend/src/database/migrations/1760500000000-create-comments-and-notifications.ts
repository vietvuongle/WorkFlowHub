import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommentsAndNotifications1760500000000
  implements MigrationInterface
{
  name = 'CreateCommentsAndNotifications1760500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "task_comments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "author_user_id" uuid NOT NULL,
        "content" text NOT NULL,
        "mentioned_user_ids" uuid[] NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_task_comments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_comments_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_task_comments_author" FOREIGN KEY ("author_user_id")
          REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_task_comments_content_not_empty"
          CHECK (length(trim("content")) > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_task_comments_task_created"
      ON "task_comments" ("task_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "recipient_user_id" uuid NOT NULL,
        "actor_user_id" uuid,
        "task_id" uuid NOT NULL,
        "comment_id" uuid NOT NULL,
        "type" character varying(40) NOT NULL,
        "task_key" character varying(30) NOT NULL,
        "content_preview" character varying(255) NOT NULL,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_by" character varying NOT NULL,
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_recipient" FOREIGN KEY ("recipient_user_id")
          REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_notifications_actor" FOREIGN KEY ("actor_user_id")
          REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_notifications_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_notifications_comment" FOREIGN KEY ("comment_id")
          REFERENCES "task_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_notifications_type"
          CHECK ("type" IN ('TASK_COMMENT_MENTION'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_created"
      ON "notifications" ("recipient_user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_unread"
      ON "notifications" ("recipient_user_id", "read_at")
      WHERE "read_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "notifications"');
    await queryRunner.query('DROP TABLE "task_comments"');
  }
}
