import { Uuid } from '@/common/types/common.type';
import { AbstractEntity } from '@/database/entities/abstract.entity';
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { TaskEntity } from './task.entity';

@Entity('task_dependencies')
@Index('UQ_task_dependencies_path', ['taskId', 'dependsOnTaskId'], {
  unique: true,
})
@Index('IDX_task_dependencies_project', ['projectId'])
@Check(
  'CHK_task_dependencies_distinct_tasks',
  '"task_id" <> "depends_on_task_id"',
)
export class TaskDependencyEntity extends AbstractEntity {
  constructor(data?: Partial<TaskDependencyEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_task_dependencies_id',
  })
  id!: Uuid;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: Uuid;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: Uuid;

  @JoinColumn({
    name: 'task_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_task_dependencies_task',
  })
  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  task!: Relation<TaskEntity>;

  @Column({ name: 'depends_on_task_id', type: 'uuid' })
  dependsOnTaskId!: Uuid;

  @JoinColumn({
    name: 'depends_on_task_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_task_dependencies_depends_on',
  })
  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  dependsOnTask!: Relation<TaskEntity>;
}
