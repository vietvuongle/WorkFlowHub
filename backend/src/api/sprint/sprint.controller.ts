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
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WORKSPACE_PERMISSIONS } from '../workspace/constants/workspace-permission.constant';
import { WorkspacePermissions } from '../workspace/decorators/workspace-permissions.decorator';
import { WorkspacePermissionGuard } from '../workspace/guards/workspace-permission.guard';
import { AssignSprintTaskReqDto } from './dto/assign-sprint-task.req.dto';
import { CreateSprintReqDto } from './dto/create-sprint.req.dto';
import { SprintTaskResDto } from './dto/sprint-task.res.dto';
import { SprintResDto } from './dto/sprint.res.dto';
import { SprintService } from './sprint.service';

@ApiTags('sprints')
@Controller({
  path: 'workspaces/:workspaceId/projects/:projectId/sprints',
  version: '1',
})
@UseGuards(WorkspacePermissionGuard)
export class SprintController {
  constructor(private readonly sprintService: SprintService) {}

  @Post()
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({
    type: SprintResDto,
    summary: 'Create a planned sprint',
    statusCode: HttpStatus.CREATED,
  })
  create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: CreateSprintReqDto,
  ): Promise<SprintResDto> {
    return this.sprintService.create(workspaceId, projectId, actorId, dto);
  }

  @Get()
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({
    type: SprintResDto,
    isArray: true,
    summary: 'List project sprints',
  })
  findAll(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<SprintResDto[]> {
    return this.sprintService.findAll(workspaceId, projectId, actorId);
  }

  @Get(':sprintId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({ type: SprintResDto, summary: 'Get a sprint' })
  findOne(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('sprintId', ParseUUIDPipe) sprintId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<SprintResDto> {
    return this.sprintService.findOne(
      workspaceId,
      projectId,
      sprintId,
      actorId,
    );
  }

  @Post(':sprintId/start')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ type: SprintResDto, summary: 'Start a planned sprint' })
  start(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('sprintId', ParseUUIDPipe) sprintId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<SprintResDto> {
    return this.sprintService.start(workspaceId, projectId, sprintId, actorId);
  }

  @Post(':sprintId/complete')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ type: SprintResDto, summary: 'Complete the active sprint' })
  complete(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('sprintId', ParseUUIDPipe) sprintId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<SprintResDto> {
    return this.sprintService.complete(
      workspaceId,
      projectId,
      sprintId,
      actorId,
    );
  }

  @Post(':sprintId/cancel')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ type: SprintResDto, summary: 'Cancel a planned or active sprint' })
  cancel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('sprintId', ParseUUIDPipe) sprintId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<SprintResDto> {
    return this.sprintService.cancel(workspaceId, projectId, sprintId, actorId);
  }

  @Get(':sprintId/tasks')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({
    type: SprintTaskResDto,
    isArray: true,
    summary: 'List tasks assigned to a sprint',
  })
  findTasks(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('sprintId', ParseUUIDPipe) sprintId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<SprintTaskResDto[]> {
    return this.sprintService.findTasks(
      workspaceId,
      projectId,
      sprintId,
      actorId,
    );
  }

  @Post(':sprintId/tasks')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ summary: 'Assign a task to a sprint', statusCode: HttpStatus.OK })
  assignTask(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('sprintId', ParseUUIDPipe) sprintId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: AssignSprintTaskReqDto,
  ): Promise<void> {
    return this.sprintService.assignTask(
      workspaceId,
      projectId,
      sprintId,
      dto.taskId as Uuid,
      actorId,
    );
  }

  @Delete(':sprintId/tasks/:taskId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ summary: 'Remove a task from a sprint' })
  removeTask(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('sprintId', ParseUUIDPipe) sprintId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<void> {
    return this.sprintService.removeTask(
      workspaceId,
      projectId,
      sprintId,
      taskId,
      actorId,
    );
  }
}
