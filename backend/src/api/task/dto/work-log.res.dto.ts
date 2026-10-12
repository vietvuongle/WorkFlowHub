import {
  ClassField,
  NumberField,
  StringField,
  StringFieldOptional,
  UUIDField,
} from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class WorkLogResDto {
  @UUIDField()
  @Expose()
  id!: string;

  @UUIDField()
  @Expose()
  taskId!: string;

  @UUIDField()
  @Expose()
  userId!: string;

  @StringField()
  @Expose()
  workDate!: string;

  @NumberField()
  @Expose()
  hours!: number;

  @StringFieldOptional({ nullable: true })
  @Expose()
  description?: string | null;

  @ClassField(() => Date)
  @Expose()
  createdAt!: Date;
}
