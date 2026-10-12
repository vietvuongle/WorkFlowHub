import {
  ClassField,
  NumberField,
  StringField,
  UUIDField,
  UUIDFieldOptional,
} from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';
import { TaskStatus } from '../entities/task.entity';

@Exclude()
export class TaskResDto {
  @UUIDField()
  @Expose()
  id!: string;

  @UUIDField()
  @Expose()
  projectId!: string;

  @UUIDFieldOptional({ nullable: true })
  @Expose()
  parentTaskId!: string | null;

  @UUIDFieldOptional({ nullable: true })
  @Expose()
  sprintId!: string | null;

  @NumberField()
  @Expose()
  number!: number;

  @StringField()
  @Expose()
  key!: string;

  @StringField()
  @Expose()
  title!: string;

  @StringField({ nullable: true })
  @Expose()
  description?: string | null;

  @NumberField()
  @Expose()
  estimateHours!: number;

  @NumberField()
  @Expose()
  loggedHours!: number;

  @NumberField()
  @Expose()
  remainingHours!: number;

  @StringField()
  @Expose()
  status!: TaskStatus;

  @ClassField(() => Date)
  @Expose()
  createdAt!: Date;

  @ClassField(() => Date)
  @Expose()
  updatedAt!: Date;
}
