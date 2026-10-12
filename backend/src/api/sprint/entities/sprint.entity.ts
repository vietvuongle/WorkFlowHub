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
import { TaskEntity } from '../../task/entities/task.entity';

export enum SprintStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('sprints')
@Index('IDX_sprints_project_start_date', ['projectId', 'startDate'])
@Index('UQ_sprints_one_active_per_project', ['projectId'], {
  unique: true,
  where: '"status" = \'ACTIVE\'',
})
export class SprintEntity extends AbstractEntity {
  constructor(data?: Partial<SprintEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_sprints_id' })
  id!: Uuid;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: Uuid;

  @JoinColumn({
    name: 'project_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_sprints_project',
  })
  @ManyToOne(() => ProjectEntity, { onDelete: 'CASCADE' })
  project!: Relation<ProjectEntity>;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  goal?: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({ type: 'varchar', length: 20, default: SprintStatus.PLANNED })
  status!: SprintStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @OneToMany(() => TaskEntity, (task) => task.sprint)
  tasks?: Relation<TaskEntity[]>;
}
