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
import { WORKSPACE_PERMISSIONS } from './constants/workspace-permission.constant';
import { WorkspacePermissions } from './decorators/workspace-permissions.decorator';
import { CreateWorkspaceReqDto } from './dto/create-workspace.req.dto';
import { UpdateWorkspaceReqDto } from './dto/update-workspace.req.dto';
import { WorkspaceResDto } from './dto/workspace.res.dto';
import { WorkspacePermissionGuard } from './guards/workspace-permission.guard';
import { WorkspaceService } from './workspace.service';

@ApiTags('workspaces')
@Controller({
  path: 'workspaces',
  version: '1',
})
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @ApiAuth({
    type: WorkspaceResDto,
    summary: 'Create a workspace',
    statusCode: HttpStatus.CREATED,
  })
  create(
    @CurrentUser('id') ownerId: Uuid,
    @Body() reqDto: CreateWorkspaceReqDto,
  ): Promise<WorkspaceResDto> {
    return this.workspaceService.create(ownerId, reqDto);
  }

  @Get()
  @ApiAuth({
    type: WorkspaceResDto,
    summary: 'List owned workspaces',
    isArray: true,
  })
  findAll(@CurrentUser('id') ownerId: Uuid): Promise<WorkspaceResDto[]> {
    return this.workspaceService.findAll(ownerId);
  }

  @Get(':id')
  @UseGuards(WorkspacePermissionGuard)
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.READ)
  @ApiAuth({
    type: WorkspaceResDto,
    summary: 'Get a workspace',
  })
  findOne(@Param('id', ParseUUIDPipe) id: Uuid): Promise<WorkspaceResDto> {
    return this.workspaceService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(WorkspacePermissionGuard)
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.UPDATE)
  @ApiAuth({
    type: WorkspaceResDto,
    summary: 'Update a workspace',
  })
  update(
    @Param('id', ParseUUIDPipe) id: Uuid,
    @CurrentUser('id') ownerId: Uuid,
    @Body() reqDto: UpdateWorkspaceReqDto,
  ): Promise<WorkspaceResDto> {
    return this.workspaceService.update(id, ownerId, reqDto);
  }

  @Delete(':id')
  @UseGuards(WorkspacePermissionGuard)
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.DELETE)
  @ApiAuth({
    summary: 'Delete a workspace',
  })
  delete(@Param('id', ParseUUIDPipe) id: Uuid): Promise<void> {
    return this.workspaceService.delete(id);
  }
}
