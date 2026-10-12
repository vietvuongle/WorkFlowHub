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
import { TaskEntity } from './task.entity';

export enum TaskAttachmentStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
}

@Entity('task_attachments')
@Index('UQ_task_attachments_public_id', ['publicId'], { unique: true })
@Index('IDX_task_attachments_task_status', ['taskId', 'status'])
export class TaskAttachmentEntity extends AbstractEntity {
  constructor(data?: Partial<TaskAttachmentEntity>) {
    super();
    Object.assign(this, data);
  }

  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_task_attachments_id',
  })
  id!: Uuid;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: Uuid;

  @JoinColumn({
    name: 'task_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_task_attachments_task',
  })
  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  task!: Relation<TaskEntity>;

  @Column({ name: 'public_id', type: 'varchar', length: 255 })
  publicId!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 10 })
  resourceType!: 'image' | 'raw';

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 100 })
  contentType!: string;

  @Column({ name: 'size_bytes', type: 'integer', nullable: true })
  sizeBytes!: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  format!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: TaskAttachmentStatus.PENDING,
  })
  status!: TaskAttachmentStatus;
}
