import { Uuid } from '@/common/types/common.type';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiAuth } from '@/decorators/http.decorators';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WORKSPACE_PERMISSIONS } from './constants/workspace-permission.constant';
import { WorkspacePermissions } from './decorators/workspace-permissions.decorator';
import { AddWorkspaceMemberReqDto } from './dto/add-workspace-member.req.dto';
import { CreateWorkspaceRoleReqDto } from './dto/create-workspace-role.req.dto';
import { PermissionResDto } from './dto/permission.res.dto';
import { UpdateWorkspaceMemberRoleReqDto } from './dto/update-workspace-member-role.req.dto';
import { UpdateWorkspaceMemberStatusReqDto } from './dto/update-workspace-member-status.req.dto';
import { UpdateWorkspaceRoleReqDto } from './dto/update-workspace-role.req.dto';
import { WorkspaceMemberResDto } from './dto/workspace-member.res.dto';
import { WorkspaceRoleResDto } from './dto/workspace-role.res.dto';
import { WorkspacePermissionGuard } from './guards/workspace-permission.guard';
import { WorkspaceAccessService } from './workspace-access.service';

@ApiTags('workspace access')
@Controller({
  path: 'workspaces/:workspaceId',
  version: '1',
})
@UseGuards(WorkspacePermissionGuard)
export class WorkspaceAccessController {
  constructor(private readonly accessService: WorkspaceAccessService) {}

  @Get('permissions')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.ROLES_READ)
  @ApiAuth({
    type: PermissionResDto,
    isArray: true,
    summary: 'List available workspace permissions',
  })
  findPermissions(): Promise<PermissionResDto[]> {
    return this.accessService.findPermissions();
  }

  @Get('roles')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.ROLES_READ)
  @ApiAuth({
    type: WorkspaceRoleResDto,
    isArray: true,
    summary: 'List workspace roles',
  })
  findRoles(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
  ): Promise<WorkspaceRoleResDto[]> {
    return this.accessService.findRoles(workspaceId);
  }

  @Post('roles')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.ROLES_MANAGE)
  @ApiAuth({
    type: WorkspaceRoleResDto,
    statusCode: 201,
    summary: 'Create a custom workspace role',
  })
  createRole(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() reqDto: CreateWorkspaceRoleReqDto,
  ): Promise<WorkspaceRoleResDto> {
    return this.accessService.createRole(workspaceId, actorId, reqDto);
  }

  @Patch('roles/:roleId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.ROLES_MANAGE)
  @ApiAuth({
    type: WorkspaceRoleResDto,
    summary: 'Update a custom workspace role',
  })
  updateRole(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('roleId', ParseUUIDPipe) roleId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() reqDto: UpdateWorkspaceRoleReqDto,
  ): Promise<WorkspaceRoleResDto> {
    return this.accessService.updateRole(workspaceId, roleId, actorId, reqDto);
  }

  @Get('members')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.MEMBERS_READ)
  @ApiAuth({
    type: WorkspaceMemberResDto,
    isArray: true,
    summary: 'List workspace members',
  })
  findMembers(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
  ): Promise<WorkspaceMemberResDto[]> {
    return this.accessService.findMembers(workspaceId);
  }

  @Post('members')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.MEMBERS_MANAGE)
  @ApiAuth({
    type: WorkspaceMemberResDto,
    statusCode: 201,
    summary: 'Add a registered user to the workspace',
  })
  addMember(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() reqDto: AddWorkspaceMemberReqDto,
  ): Promise<WorkspaceMemberResDto> {
    return this.accessService.addMember(workspaceId, actorId, reqDto);
  }

  @Patch('members/:memberId/role')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.MEMBERS_MANAGE)
  @ApiAuth({
    type: WorkspaceMemberResDto,
    summary: 'Change a workspace member role',
  })
  updateMemberRole(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('memberId', ParseUUIDPipe) memberId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() reqDto: UpdateWorkspaceMemberRoleReqDto,
  ): Promise<WorkspaceMemberResDto> {
    return this.accessService.updateMemberRole(
      workspaceId,
      memberId,
      actorId,
      reqDto,
    );
  }

  @Patch('members/:memberId/status')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.MEMBERS_MANAGE)
  @ApiAuth({
    type: WorkspaceMemberResDto,
    summary: 'Change a workspace member status',
  })
  updateMemberStatus(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('memberId', ParseUUIDPipe) memberId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() reqDto: UpdateWorkspaceMemberStatusReqDto,
  ): Promise<WorkspaceMemberResDto> {
    return this.accessService.updateMemberStatus(
      workspaceId,
      memberId,
      actorId,
      reqDto,
    );
  }
}
