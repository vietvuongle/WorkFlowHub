import { EnumField } from '@/decorators/field.decorators';
import { WorkspaceMemberStatus } from '../entities/workspace-member.entity';

export class UpdateWorkspaceMemberStatusReqDto {
  @EnumField(() => WorkspaceMemberStatus)
  status!: WorkspaceMemberStatus;
}
