import { UUIDField } from '@/decorators/field.decorators';

export class TransitionProjectReqDto {
  @UUIDField()
  statusId!: string;
}
