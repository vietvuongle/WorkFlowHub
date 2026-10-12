import { UUIDField } from '@/decorators/field.decorators';

export class UpdateWorkspaceMemberRoleReqDto {
  @UUIDField()
  roleId!: string;
}
