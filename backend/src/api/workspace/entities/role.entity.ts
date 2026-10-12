import { Uuid } from '@/common/types/common.type';
import { AbstractEntity } from '@/database/entities/abstract.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { PermissionEntity } from './permission.entity';
import { WorkspaceEntity } from './workspace.entity';

@Entity('roles')
@Index('UQ_roles_workspace_name', ['workspaceId', 'name'], { unique: true })
export class RoleEntity extends AbstractEntity {
  constructor(data?: Partial<RoleEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_roles_id' })
  id!: Uuid;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: Uuid;

  @JoinColumn({
    name: 'workspace_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_roles_workspace',
  })
  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  workspace!: Relation<WorkspaceEntity>;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'is_system', default: false })
  isSystem!: boolean;

  @ManyToMany(() => PermissionEntity)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_role_permissions_role',
    },
    inverseJoinColumn: {
      name: 'permission_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_role_permissions_permission',
    },
  })
  permissions!: Relation<PermissionEntity[]>;
}
