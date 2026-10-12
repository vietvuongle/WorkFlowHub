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
import { CreateTaskAttachmentSignatureReqDto } from './dto/create-task-attachment-signature.req.dto';
import { TaskAttachmentUploadSignatureResDto } from './dto/task-attachment-upload-signature.res.dto';
import { TaskAttachmentResDto } from './dto/task-attachment.res.dto';
import { TaskAttachmentService } from './task-attachment.service';

@ApiTags('task-attachments')
@Controller({
  path: 'workspaces/:workspaceId/projects/:projectId/tasks/:taskId/attachments',
  version: '1',
})
@UseGuards(WorkspacePermissionGuard)
export class TaskAttachmentController {
  constructor(private readonly taskAttachmentService: TaskAttachmentService) {}

  @Post('upload-signature')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({
    type: TaskAttachmentUploadSignatureResDto,
    summary: 'Create a short-lived Cloudinary upload signature',
    statusCode: HttpStatus.CREATED,
  })
  createUploadSignature(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
    @Body() dto: CreateTaskAttachmentSignatureReqDto,
  ): Promise<TaskAttachmentUploadSignatureResDto> {
    return this.taskAttachmentService.createUploadSignature(
      workspaceId,
      projectId,
      taskId,
      actorId,
      dto,
    );
  }

  @Post(':attachmentId/confirm')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({
    type: TaskAttachmentResDto,
    summary: 'Verify a completed Cloudinary upload',
    statusCode: HttpStatus.CREATED,
  })
  confirmUpload(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<TaskAttachmentResDto> {
    return this.taskAttachmentService.confirmUpload(
      workspaceId,
      projectId,
      taskId,
      attachmentId,
      actorId,
    );
  }

  @Get()
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_READ)
  @ApiAuth({
    type: TaskAttachmentResDto,
    isArray: true,
    summary: 'List task attachments with expiring download links',
  })
  findTaskAttachments(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<TaskAttachmentResDto[]> {
    return this.taskAttachmentService.findTaskAttachments(
      workspaceId,
      projectId,
      taskId,
      actorId,
    );
  }

  @Delete(':attachmentId')
  @WorkspacePermissions(WORKSPACE_PERMISSIONS.TASKS_MANAGE)
  @ApiAuth({ summary: 'Delete a task attachment from Cloudinary' })
  deleteTaskAttachment(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: Uuid,
    @Param('projectId', ParseUUIDPipe) projectId: Uuid,
    @Param('taskId', ParseUUIDPipe) taskId: Uuid,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: Uuid,
    @CurrentUser('id') actorId: Uuid,
  ): Promise<void> {
    return this.taskAttachmentService.deleteTaskAttachment(
      workspaceId,
      projectId,
      taskId,
      attachmentId,
      actorId,
    );
  }
}
