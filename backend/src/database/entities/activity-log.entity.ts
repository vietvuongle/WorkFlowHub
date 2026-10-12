import { Uuid } from '@/common/types/common.type';
import { AbstractEntity } from '@/database/entities/abstract.entity';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('activity_logs')
@Index('IDX_activity_logs_workspace_created', ['workspaceId', 'createdAt'])
@Index('IDX_activity_logs_project_created', ['projectId', 'createdAt'])
@Index('IDX_activity_logs_task_created', ['taskId', 'createdAt'])
export class ActivityLogEntity extends AbstractEntity {
  constructor(data?: Partial<ActivityLogEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_activity_logs_id',
  })
  id!: Uuid;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: Uuid;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId!: Uuid | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId!: Uuid | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: Uuid;

  @Column({ type: 'varchar', length: 20 })
  action!: string;

  @Column({ name: 'actor_id', type: 'varchar', length: 100 })
  actorId!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
