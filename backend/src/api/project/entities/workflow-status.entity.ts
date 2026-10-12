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

@Entity('workflow_statuses')
@Index('UQ_workflow_statuses_workflow_key', ['workflowId', 'key'], {
  unique: true,
})
@Index('UQ_workflow_statuses_workflow_position', ['workflowId', 'position'], {
  unique: true,
})
@Index('UQ_workflow_statuses_initial', ['workflowId'], {
  unique: true,
  where: '"is_initial" = true',
})
export class WorkflowStatusEntity extends AbstractEntity {
  constructor(data?: Partial<WorkflowStatusEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_workflow_statuses_id',
  })
  id!: Uuid;

  @Column({ name: 'workflow_id', type: 'uuid' })
  workflowId!: Uuid;

  @JoinColumn({
    name: 'workflow_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_workflow_statuses_workflow',
  })
  @ManyToOne(() => ProjectWorkflowEntity, (workflow) => workflow.statuses, {
    onDelete: 'CASCADE',
  })
  workflow!: Relation<ProjectWorkflowEntity>;

  @Column({ length: 30 })
  key!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'integer' })
  position!: number;

  @Column({ name: 'is_initial', default: false })
  isInitial!: boolean;

  @Column({ name: 'is_final', default: false })
  isFinal!: boolean;
}
