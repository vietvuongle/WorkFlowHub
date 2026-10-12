import { UserEntity } from '@/api/user/entities/user.entity';
import { Uuid } from '@/common/types/common.type';
import { AbstractEntity } from '@/database/entities/abstract.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { TaskEntity } from '../../task/entities/task.entity';
import { TaskCommentEntity } from './task-comment.entity';

export enum NotificationType {
  TASK_COMMENT_MENTION = 'TASK_COMMENT_MENTION',
}

@Entity('notifications')
@Index('IDX_notifications_recipient_created', ['recipientUserId', 'createdAt'])
@Index('IDX_notifications_recipient_unread', ['recipientUserId', 'readAt'], {
  where: '"read_at" IS NULL',
})
export class NotificationEntity extends AbstractEntity {
  constructor(data?: Partial<NotificationEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_notifications_id',
  })
  id!: Uuid;

  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId!: Uuid;

  @JoinColumn({
    name: 'recipient_user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_notifications_recipient',
  })
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  recipient!: Relation<UserEntity>;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: Uuid | null;

  @JoinColumn({
    name: 'actor_user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_notifications_actor',
  })
  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  actor!: Relation<UserEntity> | null;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: Uuid;

  @JoinColumn({
    name: 'task_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_notifications_task',
  })
  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  task!: Relation<TaskEntity>;

  @Column({ name: 'comment_id', type: 'uuid' })
  commentId!: Uuid;

  @JoinColumn({
    name: 'comment_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_notifications_comment',
  })
  @ManyToOne(() => TaskCommentEntity, { onDelete: 'CASCADE' })
  comment!: Relation<TaskCommentEntity>;

  @Column({ type: 'varchar', length: 40 })
  type!: NotificationType;

  @Column({ name: 'task_key', type: 'varchar', length: 30 })
  taskKey!: string;

  @Column({ name: 'content_preview', type: 'varchar', length: 255 })
  contentPreview!: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;
}
