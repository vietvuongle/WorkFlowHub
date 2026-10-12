import { Uuid } from '@/common/types/common.type';
import { AbstractEntity } from '@/database/entities/abstract.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { ProjectEntity } from '../../project/entities/project.entity';
import { SprintEntity } from '../../sprint/entities/sprint.entity';
import { WorkLogEntity } from './work-log.entity';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

@Entity('tasks')
@Index('UQ_tasks_project_number', ['projectId', 'number'], { unique: true })
@Index('UQ_tasks_project_key', ['projectId', 'key'], { unique: true })
@Index('IDX_tasks_project_status', ['projectId', 'status'])
export class TaskEntity extends AbstractEntity {
  constructor(data?: Partial<TaskEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_tasks_id' })
  id!: Uuid;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: Uuid;

  @JoinColumn({
    name: 'project_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_tasks_project',
  })
  @ManyToOne(() => ProjectEntity, { onDelete: 'CASCADE' })
  project!: Relation<ProjectEntity>;

  @Column({ name: 'parent_task_id', type: 'uuid', nullable: true })
  parentTaskId!: Uuid | null;

  @JoinColumn({
    name: 'parent_task_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_tasks_parent_task',
  })
  @ManyToOne(() => TaskEntity, (task) => task.subtasks, {
    onDelete: 'SET NULL',
  })
  parentTask?: Relation<TaskEntity> | null;

  @Column({ type: 'integer' })
  number!: number;

  @Column({ length: 30 })
  key!: string;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'integer', name: 'estimate_minutes' })
  estimateMinutes!: number;

  @Column({ type: 'integer', name: 'logged_minutes', default: 0 })
  loggedMinutes!: number;

  @Column({ type: 'integer', name: 'remaining_minutes' })
  remainingMinutes!: number;

  @Column({ type: 'varchar', length: 20, default: TaskStatus.TODO })
  status!: TaskStatus;

  @Column({ name: 'sprint_id', type: 'uuid', nullable: true })
  sprintId!: Uuid | null;

  @JoinColumn({
    name: 'sprint_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_tasks_sprint',
  })
  @ManyToOne(() => SprintEntity, (sprint) => sprint.tasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  sprint?: Relation<SprintEntity> | null;

  @OneToMany(() => TaskEntity, (task) => task.parentTask)
  subtasks?: Relation<TaskEntity[]>;

  @OneToMany(() => WorkLogEntity, (workLog) => workLog.task)
  workLogs?: Relation<WorkLogEntity[]>;
}
