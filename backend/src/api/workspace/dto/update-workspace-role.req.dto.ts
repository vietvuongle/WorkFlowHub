import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkspaceRoleReqDto } from './create-workspace-role.req.dto';

export class UpdateWorkspaceRoleReqDto extends PartialType(
  CreateWorkspaceRoleReqDto,
) {}
