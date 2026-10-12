import { UUIDField } from '@/decorators/field.decorators';

export class AssignSprintTaskReqDto {
  @UUIDField()
  taskId!: string;
}
