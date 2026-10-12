import { StringField, UUIDField } from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class TaskDependencyResDto {
  @UUIDField()
  @Expose()
  id!: string;

  @UUIDField()
  @Expose()
  taskId!: string;

  @UUIDField()
  @Expose()
  dependsOnTaskId!: string;

  @StringField()
  @Expose()
  dependsOnTaskKey!: string;

  @StringField()
  @Expose()
  dependsOnTaskTitle!: string;
}
