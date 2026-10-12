import { UUIDField } from '@/decorators/field.decorators';

export class AddProjectMemberReqDto {
  @UUIDField()
  userId!: string;
}
