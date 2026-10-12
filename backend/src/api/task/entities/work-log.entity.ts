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
import { TaskEntity } from './task.entity';

@Entity('task_work_logs')
@Index('IDX_task_work_logs_task_date', ['taskId', 'workDate'])
export class WorkLogEntity extends AbstractEntity {
  constructor(data?: Partial<WorkLogEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_task_work_logs_id',
  })
  id!: Uuid;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: Uuid;

  @JoinColumn({
    name: 'task_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_task_work_logs_task',
  })
  @ManyToOne(() => TaskEntity, (task) => task.workLogs, { onDelete: 'CASCADE' })
  task!: Relation<TaskEntity>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: Uuid;

  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_task_work_logs_user',
  })
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user!: Relation<UserEntity>;

  @Column({ name: 'work_date', type: 'date' })
  workDate!: string;

  @Column({ name: 'duration_minutes', type: 'integer' })
  durationMinutes!: number;

  @Column({ type: 'text', nullable: true })
  description?: string | null;
}
