import {
  ClassField,
  StringField,
  UUIDField,
} from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';
import { SprintStatus } from '../entities/sprint.entity';

@Exclude()
export class SprintResDto {
  @UUIDField()
  @Expose()
  id!: string;

  @UUIDField()
  @Expose()
  projectId!: string;

  @StringField()
  @Expose()
  name!: string;

  @StringField({ nullable: true })
  @Expose()
  goal?: string | null;

  @StringField()
  @Expose()
  startDate!: string;

  @StringField()
  @Expose()
  endDate!: string;

  @StringField()
  @Expose()
  status!: SprintStatus;

  @ClassField(() => Date, { nullable: true })
  @Expose()
  completedAt?: Date | null;
}
