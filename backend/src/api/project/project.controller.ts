import { Uuid } from '@/common/types/common.type';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiAuth } from '@/decorators/http.decorators';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WORKSPACE_PERMISSIONS } from '../workspace/constants/workspace-permission.constant';
import { WorkspacePermissions } from '../workspace/decorators/workspace-permissions.decorator';
import { WorkspacePermissionGuard } from '../workspace/guards/workspace-permission.guard';
import { AddProjectMemberReqDto } from './dto/add-project-member.req.dto';
import { CreateProjectReqDto } from './dto/create-project.req.dto';
import { ProjectMemberResDto } from './dto/project-member.res.dto';
import { ProjectResDto } from './dto/project.res.dto';
import { TransitionProjectReqDto } from './dto/transition-project.req.dto';
import { UpdateProjectReqDto } from './dto/update-project.req.dto';
import { ProjectService } from './project.service';

@ApiTags('projects')
@Controller({
  path: 'workspaces/:workspaceId/projects',
  version: '1',
})
@UseGuards(WorkspacePermissionGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.PROJECTS_MANAGE)
  @ApiAuth({
    type: ProjectResDto,
    summary: 'Create a project with its default workflow',
    statusCode: HttpStatus.CREATED,
  })
  create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() reqDto: CreateProjectReqDto,
  ): Promise<ProjectResDto> {
    return this.projectService.create(workspaceId, actorId, reqDto);
  }

  @Get()
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.PROJECTS_READ)
  @ApiAuth({
    type: ProjectResDto,
    isArray: true,
    summary: 'List projects the current user belongs to',
  })
  findAll(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @CurrentUser('id') userId: Uuid,
  ): Promise<ProjectResDto[]> {
    return this.projectService.findAll(workspaceId, userId);
  }

  @Get(':projectId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.PROJECTS_READ)
  @ApiAuth({ type: ProjectResDto, summary: 'Get a project' })
  findOne(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') userId: Uuid,
  ): Promise<ProjectResDto> {
    return this.projectService.findOne(workspaceId, projectId, userId);
  }

  @Patch(':projectId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.PROJECTS_MANAGE)
  @ApiAuth({ type: ProjectResDto, summary: 'Update a project' })
  update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() reqDto: UpdateProjectReqDto,
  ): Promise<ProjectResDto> {
    return this.projectService.update(workspaceId, projectId, actorId, reqDto);
  }

  @Delete(':projectId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.PROJECTS_MANAGE)
  @ApiAuth({ summary: 'Delete a project' })
  delete(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<void> {
    return this.projectService.delete(workspaceId, projectId, actorId);
  }

  @Get(':projectId/members')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.PROJECTS_READ)
  @ApiAuth({
    type: ProjectMemberResDto,
    isArray: true,
    summary: 'List project members',
  })
  findMembers(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<ProjectMemberResDto[]> {
    return this.projectService.findMembers(workspaceId, projectId, actorId);
  }

  @Post(':projectId/members')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.PROJECTS_MANAGE)
  @ApiAuth({
    type: ProjectMemberResDto,
    summary: 'Add an active workspace member to a project',
    statusCode: HttpStatus.CREATED,
  })
  addMember(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() reqDto: AddProjectMemberReqDto,
  ): Promise<ProjectMemberResDto> {
    return this.projectService.addMember(
      workspaceId,
      projectId,
      actorId,
      reqDto,
    );
  }

  @Delete(':projectId/members/:userId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.PROJECTS_MANAGE)
  @ApiAuth({ summary: 'Remove a project member' })
  removeMember(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('userId', ParseUUIDPipe) userId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<void> {
    return this.projectService.removeMember(
      workspaceId,
      projectId,
      userId,
      actorId,
    );
  }

  @Patch(':projectId/status')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.WORKFLOW_MANAGE)
  @ApiAuth({
    type: ProjectResDto,
    summary: 'Transition a project to an allowed workflow status',
  })
  transition(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() reqDto: TransitionProjectReqDto,
  ): Promise<ProjectResDto> {
    return this.projectService.transition(
      workspaceId,
      projectId,
      actorId,
      reqDto,
    );
  }
}
