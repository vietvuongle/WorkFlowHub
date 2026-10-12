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
import { ProjectEntity } from './project.entity';

@Entity('project_members')
@Index('UQ_project_members_project_user', ['projectId', 'userId'], {
  unique: true,
})
@Index('IDX_project_members_user', ['userId'])
export class ProjectMemberEntity extends AbstractEntity {
  constructor(data?: Partial<ProjectMemberEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_project_members_id',
  })
  id!: Uuid;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: Uuid;

  @JoinColumn({
    name: 'project_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_project_members_project',
  })
  @ManyToOne(() => ProjectEntity, (project) => project.members, {
    onDelete: 'CASCADE',
  })
  project!: Relation<ProjectEntity>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: Uuid;

  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_project_members_user',
  })
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user!: Relation<UserEntity>;
}
