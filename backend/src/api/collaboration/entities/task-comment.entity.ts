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

@Entity('task_comments')
@Index('IDX_task_comments_task_created', ['taskId', 'createdAt'])
export class TaskCommentEntity extends AbstractEntity {
  constructor(data?: Partial<TaskCommentEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_task_comments_id',
  })
  id!: Uuid;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: Uuid;

  @JoinColumn({
    name: 'task_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_task_comments_task',
  })
  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  task!: Relation<TaskEntity>;

  @Column({ name: 'author_user_id', type: 'uuid' })
  authorUserId!: Uuid;

  @JoinColumn({
    name: 'author_user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_task_comments_author',
  })
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  author!: Relation<UserEntity>;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    name: 'mentioned_user_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  mentionedUserIds!: Uuid[];
}
