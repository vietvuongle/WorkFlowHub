import { OffsetPaginatedDto } from '@/common/dto/offset-pagination/paginated.dto';
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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CollaborationService } from '../collaboration/collaboration.service';
import { CreateTaskCommentReqDto } from '../collaboration/dto/create-task-comment.req.dto';
import { TaskCommentResDto } from '../collaboration/dto/task-comment.res.dto';
import { WORKSPACE_PERMISSIONS } from '../workspace/constants/workspace-permission.constant';
import { WorkspacePermissions } from '../workspace/decorators/workspace-permissions.decorator';
import { WorkspacePermissionGuard } from '../workspace/guards/workspace-permission.guard';
import { CreateTaskDependencyReqDto } from './dto/create-task-dependency.req.dto';
import { CreateTaskReqDto } from './dto/create-task.req.dto';
import { CreateWorkLogReqDto } from './dto/create-work-log.req.dto';
import { SearchTasksReqDto } from './dto/search-tasks.req.dto';
import { TaskDependencyResDto } from './dto/task-dependency.res.dto';
import { TaskResDto } from './dto/task.res.dto';
import { UpdateTaskRemainingReqDto } from './dto/update-task-remaining.req.dto';
import { UpdateTaskStatusReqDto } from './dto/update-task-status.req.dto';
import { UpdateTaskReqDto } from './dto/update-task.req.dto';
import { UpdateWorkLogReqDto } from './dto/update-work-log.req.dto';
import { WorkLogResDto } from './dto/work-log.res.dto';
import { TaskService } from './task.service';

@ApiTags('tasks')
@Controller({
  path: 'workspaces/:workspaceId/projects/:projectId/tasks',
  version: '1',
})
@UseGuards(WorkspacePermissionGuard)
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly collaborationService: CollaborationService,
  ) {}

  @Post()
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({
    type: TaskResDto,
    summary: 'Create a task with an estimate',
    statusCode: HttpStatus.CREATED,
  })
  create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: CreateTaskReqDto,
  ): Promise<TaskResDto> {
    return this.taskService.create(workspaceId, projectId, actorId, dto);
  }

  @Get()
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({ type: TaskResDto, isArray: true, summary: 'List project tasks' })
  findAll(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<TaskResDto[]> {
    return this.taskService.findAll(workspaceId, projectId, actorId);
  }

  @Get('search')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({
    type: TaskResDto,
    isPaginated: true,
    summary: 'Search and filter project tasks',
  })
  search(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Query() reqDto: SearchTasksReqDto,
  ): Promise<OffsetPaginatedDto<TaskResDto>> {
    return this.taskService.search(workspaceId, projectId, actorId, reqDto);
  }

  @Get(':taskId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({ type: TaskResDto, summary: 'Get a task' })
  findOne(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<TaskResDto> {
    return this.taskService.findOne(workspaceId, projectId, taskId, actorId);
  }

  @Get(':taskId/comments')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({
    type: TaskCommentResDto,
    isArray: true,
    summary: 'List comments on a task',
  })
  findComments(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<TaskCommentResDto[]> {
    return this.collaborationService.findTaskComments(
      workspaceId,
      projectId,
      taskId,
      actorId,
    );
  }

  @Post(':taskId/comments')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({
    type: TaskCommentResDto,
    summary: 'Comment on a task and mention project members',
    statusCode: HttpStatus.CREATED,
  })
  createComment(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: CreateTaskCommentReqDto,
  ): Promise<TaskCommentResDto> {
    return this.collaborationService.createTaskComment(
      workspaceId,
      projectId,
      taskId,
      actorId,
      dto,
    );
  }

  @Get(':taskId/subtasks')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({ type: TaskResDto, isArray: true, summary: 'List subtasks' })
  findSubtasks(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<TaskResDto[]> {
    return this.taskService.findSubtasks(
      workspaceId,
      projectId,
      taskId,
      actorId,
    );
  }

  @Get(':taskId/dependencies')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({
    type: TaskDependencyResDto,
    isArray: true,
    summary: 'List task dependencies',
  })
  findDependencies(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<TaskDependencyResDto[]> {
    return this.taskService.findDependencies(
      workspaceId,
      projectId,
      taskId,
      actorId,
    );
  }

  @Post(':taskId/dependencies')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({
    type: TaskDependencyResDto,
    summary: 'Add a task dependency',
    statusCode: HttpStatus.CREATED,
  })
  addDependency(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: CreateTaskDependencyReqDto,
  ): Promise<TaskDependencyResDto> {
    return this.taskService.addDependency(
      workspaceId,
      projectId,
      taskId,
      actorId,
      dto,
    );
  }

  @Delete(':taskId/dependencies/:dependencyId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ summary: 'Remove a task dependency' })
  removeDependency(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @Param('dependencyId', ParseUUIDPipe) dependencyId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<void> {
    return this.taskService.removeDependency(
      workspaceId,
      projectId,
      taskId,
      dependencyId,
      actorId,
    );
  }

  @Patch(':taskId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ type: TaskResDto, summary: 'Update a task or its estimate' })
  update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: UpdateTaskReqDto,
  ): Promise<TaskResDto> {
    return this.taskService.update(
      workspaceId,
      projectId,
      taskId,
      actorId,
      dto,
    );
  }

  @Delete(':taskId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ summary: 'Delete a task and its work logs' })
  delete(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<void> {
    return this.taskService.delete(workspaceId, projectId, taskId, actorId);
  }

  @Patch(':taskId/remaining')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({
    type: TaskResDto,
    summary: 'Manually update remaining estimate after an overrun',
  })
  updateRemaining(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: UpdateTaskRemainingReqDto,
  ): Promise<TaskResDto> {
    return this.taskService.updateRemaining(
      workspaceId,
      projectId,
      taskId,
      actorId,
      dto,
    );
  }

  @Patch(':taskId/status')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ type: TaskResDto, summary: 'Change task status or reopen it' })
  updateStatus(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: UpdateTaskStatusReqDto,
  ): Promise<TaskResDto> {
    return this.taskService.updateStatus(
      workspaceId,
      projectId,
      taskId,
      actorId,
      dto,
    );
  }

  @Post(':taskId/work-logs')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({
    type: WorkLogResDto,
    summary: 'Log time spent on a task',
    statusCode: HttpStatus.CREATED,
  })
  addWorkLog(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: CreateWorkLogReqDto,
  ): Promise<WorkLogResDto> {
    return this.taskService.addWorkLog(
      workspaceId,
      projectId,
      taskId,
      actorId,
      dto,
    );
  }

  @Get(':taskId/work-logs')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({
    type: WorkLogResDto,
    isArray: true,
    summary: 'List task work logs',
  })
  findWorkLogs(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<WorkLogResDto[]> {
    return this.taskService.findWorkLogs(
      workspaceId,
      projectId,
      taskId,
      actorId,
    );
  }

  @Patch(':taskId/work-logs/:workLogId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({
    type: WorkLogResDto,
    summary: 'Correct the date, hours, or description of your work log',
  })
  updateWorkLog(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @Param('workLogId', ParseUUIDPipe) workLogId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: UpdateWorkLogReqDto,
  ): Promise<WorkLogResDto> {
    return this.taskService.updateWorkLog(
      workspaceId,
      projectId,
      taskId,
      workLogId,
      actorId,
      dto,
    );
  }

  @Delete(':taskId/work-logs/:workLogId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ summary: 'Delete your work log' })
  deleteWorkLog(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @Param('workLogId', ParseUUIDPipe) workLogId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<void> {
    return this.taskService.deleteWorkLog(
      workspaceId,
      projectId,
      taskId,
      workLogId,
      actorId,
    );
  }
}
