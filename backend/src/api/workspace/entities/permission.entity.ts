import { Uuid } from '@/common/types/common.type';
import { AbstractEntity } from '@/database/entities/abstract.entity';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permissions')
@Index('UQ_permissions_code', ['code'], { unique: true })
export class PermissionEntity extends AbstractEntity {
  constructor(data?: Partial<PermissionEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_permissions_id',
  })
  id!: Uuid;

  @Column({ length: 100 })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;
}
