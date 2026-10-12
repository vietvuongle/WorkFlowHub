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

@Entity('workspaces')
export class WorkspaceEntity extends AbstractEntity {
  constructor(data?: Partial<WorkspaceEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_workspaces_id',
  })
  id!: Uuid;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 255 })
  @Index('UQ_workspaces_slug', { unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'owner_id', type: 'uuid' })
  @Index('IDX_workspaces_owner_id')
  ownerId!: Uuid;

  @JoinColumn({
    name: 'owner_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_workspaces_owner',
  })
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  owner!: Relation<UserEntity>;
}
