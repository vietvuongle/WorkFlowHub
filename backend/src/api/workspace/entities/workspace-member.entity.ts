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
import { RoleEntity } from './role.entity';
import { WorkspaceEntity } from './workspace.entity';

export enum WorkspaceMemberStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Entity('workspace_members')
@Index('UQ_workspace_members_workspace_user', ['workspaceId', 'userId'], {
  unique: true,
})
@Index('IDX_workspace_members_user_status', ['userId', 'status'])
export class WorkspaceMemberEntity extends AbstractEntity {
  constructor(data?: Partial<WorkspaceMemberEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_workspace_members_id',
  })
  id!: Uuid;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: Uuid;

  @JoinColumn({
    name: 'workspace_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_workspace_members_workspace',
  })
  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  workspace!: Relation<WorkspaceEntity>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: Uuid;

  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_workspace_members_user',
  })
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user!: Relation<UserEntity>;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: Uuid;

  @JoinColumn({
    name: 'role_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_workspace_members_role',
  })
  @ManyToOne(() => RoleEntity, { onDelete: 'RESTRICT' })
  role!: Relation<RoleEntity>;

  @Column({ length: 20, default: WorkspaceMemberStatus.ACTIVE })
  status!: WorkspaceMemberStatus;

  @Column({
    name: 'joined_at',
    type: 'timestamptz',
    nullable: true,
  })
  joinedAt?: Date | null;
}
