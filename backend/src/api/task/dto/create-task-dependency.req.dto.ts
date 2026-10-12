import { UUIDField } from '@/decorators/field.decorators';

export class CreateTaskDependencyReqDto {
  @UUIDField()
  dependsOnTaskId!: string;
}
