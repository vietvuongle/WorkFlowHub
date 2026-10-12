import { EnumField } from '@/decorators/field.decorators';
import { TaskStatus } from '../entities/task.entity';

export class UpdateTaskStatusReqDto {
  @EnumField(() => TaskStatus)
  status!: TaskStatus;
}
