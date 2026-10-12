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
import { ProjectWorkflowEntity } from './project-workflow.entity';
import { WorkflowStatusEntity } from './workflow-status.entity';

@Entity('workflow_transitions')
@Index(
  'UQ_workflow_transitions_path',
  ['workflowId', 'fromStatusId', 'toStatusId'],
  { unique: true },
)
export class WorkflowTransitionEntity extends AbstractEntity {
  constructor(data?: Partial<WorkflowTransitionEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_workflow_transitions_id',
  })
  id!: Uuid;

  @Column({ name: 'workflow_id', type: 'uuid' })
  workflowId!: Uuid;

  @JoinColumn({
    name: 'workflow_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_workflow_transitions_workflow',
  })
  @ManyToOne(() => ProjectWorkflowEntity, (workflow) => workflow.transitions, {
    onDelete: 'CASCADE',
  })
  workflow!: Relation<ProjectWorkflowEntity>;

  @Column({ name: 'from_status_id', type: 'uuid' })
  fromStatusId!: Uuid;

  @JoinColumn({
    name: 'from_status_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_workflow_transitions_from_status',
  })
  @ManyToOne(() => WorkflowStatusEntity, { onDelete: 'CASCADE' })
  fromStatus!: Relation<WorkflowStatusEntity>;

  @Column({ name: 'to_status_id', type: 'uuid' })
  toStatusId!: Uuid;

  @JoinColumn({
    name: 'to_status_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_workflow_transitions_to_status',
  })
  @ManyToOne(() => WorkflowStatusEntity, { onDelete: 'CASCADE' })
  toStatus!: Relation<WorkflowStatusEntity>;
}
