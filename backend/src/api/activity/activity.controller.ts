import { Uuid } from '@/common/types/common.type';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiAuth } from '@/decorators/http.decorators';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WORKSPACE_PERMISSIONS } from '../workspace/constants/workspace-permission.constant';
import { WorkspacePermissions } from '../workspace/decorators/workspace-permissions.decorator';
import { WorkspacePermissionGuard } from '../workspace/guards/workspace-permission.guard';
import { ActivityService } from './activity.service';
import { ActivityLogResDto } from './dto/activity-log.res.dto';

@ApiTags('activity')
@Controller({ path: 'workspaces/:workspaceId/activity', version: '1' })
@UseGuards(WorkspacePermissionGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.ACTIVITY_READ)
  @ApiAuth({
    type: ActivityLogResDto,
    isArray: true,
    summary: 'List recent activity in a workspace',
  })
  findWorkspaceActivity(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @CurrentUser('id') userId: Uuid,
  ): Promise<ActivityLogResDto[]> {
    return this.activityService.findWorkspaceActivity(workspaceId, userId);
  }
}
