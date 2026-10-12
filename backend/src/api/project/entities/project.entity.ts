import { Uuid } from '@/common/types/common.type';
import { AbstractEntity } from '@/database/entities/abstract.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { WorkspaceEntity } from '../../workspace/entities/workspace.entity';
import { ProjectMemberEntity } from './project-member.entity';
import { ProjectWorkflowEntity } from './project-workflow.entity';
import { WorkflowStatusEntity } from './workflow-status.entity';

@Entity('projects')
@Index('UQ_projects_workspace_key', ['workspaceId', 'key'], { unique: true })
export class ProjectEntity extends AbstractEntity {
  constructor(data?: Partial<ProjectEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_projects_id',
  })
  id!: Uuid;

  @Column({ name: 'workspace_id', type: 'uuid' })
  @Index('IDX_projects_workspace')
  workspaceId!: Uuid;

  @JoinColumn({
    name: 'workspace_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_projects_workspace',
  })
  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  workspace!: Relation<WorkspaceEntity>;

  @Column({ length: 255 })
  name!: string;

  @Column({ name: 'key', length: 10 })
  key!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'current_status_id', type: 'uuid', nullable: true })
  currentStatusId!: Uuid | null;

  @Column({ name: 'next_task_number', type: 'integer', default: 1 })
  nextTaskNumber!: number;

  @JoinColumn({
    name: 'current_status_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_projects_current_status',
  })
  @ManyToOne(() => WorkflowStatusEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  currentStatus?: Relation<WorkflowStatusEntity> | null;

  @OneToOne(() => ProjectWorkflowEntity, (workflow) => workflow.project)
  workflow?: Relation<ProjectWorkflowEntity>;

  @OneToMany(() => ProjectMemberEntity, (member) => member.project)
  members?: Relation<ProjectMemberEntity[]>;
}
