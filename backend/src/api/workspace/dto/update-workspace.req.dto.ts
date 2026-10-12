import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkspaceReqDto } from './create-workspace.req.dto';

export class UpdateWorkspaceReqDto extends PartialType(CreateWorkspaceReqDto) {}
