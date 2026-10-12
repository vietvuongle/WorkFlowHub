import { Uuid } from '@/common/types/common.type';
import { AbstractEntity } from '@/database/entities/abstract.entity';
import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { ProjectEntity } from './project.entity';
import { WorkflowStatusEntity } from './workflow-status.entity';
import { WorkflowTransitionEntity } from './workflow-transition.entity';

@Entity('project_workflows')
export class ProjectWorkflowEntity extends AbstractEntity {
  constructor(data?: Partial<ProjectWorkflowEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_project_workflows_id',
  })
  id!: Uuid;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: Uuid;

  @JoinColumn({
    name: 'project_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_project_workflows_project',
  })
  @OneToOne(() => ProjectEntity, (project) => project.workflow, {
    onDelete: 'CASCADE',
  })
  project!: Relation<ProjectEntity>;

  @Column({ length: 100, default: 'Default workflow' })
  name!: string;

  @OneToMany(() => WorkflowStatusEntity, (status) => status.workflow)
  statuses?: Relation<WorkflowStatusEntity[]>;

  @OneToMany(
    () => WorkflowTransitionEntity,
    (transition) => transition.workflow,
  )
  transitions?: Relation<WorkflowTransitionEntity[]>;
}
