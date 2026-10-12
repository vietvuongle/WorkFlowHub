import {
  ClassField,
  StringField,
  UUIDField,
  UUIDFieldOptional,
} from '@/decorators/field.decorators';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ActivityLogResDto {
  @UUIDField()
  @Expose()
  id!: string;

  @StringField()
  @Expose()
  entityType!: string;

  @UUIDField()
  @Expose()
  entityId!: string;

  @StringField()
  @Expose()
  action!: string;

  @StringField()
  @Expose()
  actorId!: string;

  @ApiProperty({ type: Object })
  @Expose()
  metadata!: Record<string, unknown>;

  @UUIDFieldOptional({ nullable: true })
  @Expose()
  projectId!: string | null;

  @UUIDFieldOptional({ nullable: true })
  @Expose()
  taskId!: string | null;

  @ClassField(() => Date)
  @Expose()
  createdAt!: Date;
}
