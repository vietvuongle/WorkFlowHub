import { Uuid } from '@/common/types/common.type';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiAuth } from '@/decorators/http.decorators';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WORKSPACE_PERMISSIONS } from '../workspace/constants/workspace-permission.constant';
import { WorkspacePermissions } from '../workspace/decorators/workspace-permissions.decorator';
import { WorkspacePermissionGuard } from '../workspace/guards/workspace-permission.guard';
import { AnalyticsService } from './analytics.service';
import {
  CycleTimeResDto,
  ProjectAnalyticsSummaryResDto,
  SprintBurndownResDto,
  SprintVelocityResDto,
} from './dto/analytics.res.dto';
import { GetSprintVelocityReqDto } from './dto/get-sprint-velocity.req.dto';

@ApiTags('analytics')
@Controller({
  path: 'workspaces/:workspaceId/projects/:projectId/analytics',
  version: '1',
})
@UseGuards(WorkspacePermissionGuard)
@WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiAuth({
    type: ProjectAnalyticsSummaryResDto,
    summary: 'Get project task and estimate summary',
  })
  getProjectSummary(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<ProjectAnalyticsSummaryResDto> {
    return this.analyticsService.getProjectSummary(
      workspaceId,
      projectId,
      actorId,
    );
  }

  @Get('velocity')
  @ApiAuth({
    type: SprintVelocityResDto,
    summary: 'Get completed sprint velocity',
  })
  getSprintVelocity(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Query() reqDto: GetSprintVelocityReqDto,
  ): Promise<SprintVelocityResDto> {
    return this.analyticsService.getSprintVelocity(
      workspaceId,
      projectId,
      actorId,
      reqDto,
    );
  }

  @Get('cycle-time')
  @ApiAuth({
    type: CycleTimeResDto,
    summary: 'Get task cycle time from status transition history',
  })
  getCycleTime(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<CycleTimeResDto> {
    return this.analyticsService.getCycleTime(workspaceId, projectId, actorId);
  }

  @Get('sprints/:sprintId/burndown')
  @ApiAuth({
    type: SprintBurndownResDto,
    summary: 'Get estimate-based sprint burndown',
  })
  getSprintBurndown(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('sprintId', ParseUUIDPipe) sprintId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<SprintBurndownResDto> {
    return this.analyticsService.getSprintBurndown(
      workspaceId,
      projectId,
      sprintId,
      actorId,
    );
  }
}
