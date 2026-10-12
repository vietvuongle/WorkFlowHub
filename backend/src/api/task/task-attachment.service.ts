import { Uuid } from '@/common/types/common.type';
import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import {
  CloudinaryResourceType,
  CloudinaryService,
} from '../../cloudinary/cloudinary.service';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import {
  CreateTaskAttachmentSignatureReqDto,
  TaskAttachmentContentType,
} from './dto/create-task-attachment-signature.req.dto';
import { TaskAttachmentUploadSignatureResDto } from './dto/task-attachment-upload-signature.res.dto';
import { TaskAttachmentResDto } from './dto/task-attachment.res.dto';
import {
  TaskAttachmentEntity,
  TaskAttachmentStatus,
} from './entities/task-attachment.entity';
import { TaskEntity } from './entities/task.entity';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SIGNATURE_MAX_AGE_MILLISECONDS = 60 * 60 * 1000;
const CONTENT_TYPE_FORMATS: Record<TaskAttachmentContentType, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
};

@Injectable()
export class TaskAttachmentService {
  constructor(
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMemberRepository: Repository<ProjectMemberEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(TaskAttachmentEntity)
    private readonly attachmentRepository: Repository<TaskAttachmentEntity>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createUploadSignature(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
    dto: CreateTaskAttachmentSignatureReqDto,
  ): Promise<TaskAttachmentUploadSignatureResDto> {
    await this.assertTaskAccess(workspaceId, projectId, taskId, actorId);
    const fileName = this.normalizeFileName(dto.fileName);
    const resourceType: CloudinaryResourceType =
      dto.contentType === 'application/pdf' ? 'raw' : 'image';
    const publicId = `workflowhub/workspaces/${workspaceId}/tasks/${taskId}/${randomUUID()}`;
    const signature = this.cloudinaryService.createUploadSignature(
      publicId,
      resourceType,
    );

    const attachment = this.attachmentRepository.create({
      taskId,
      publicId,
      resourceType,
      originalFilename: fileName,
      contentType: dto.contentType,
      sizeBytes: null,
      format: null,
      status: TaskAttachmentStatus.PENDING,
      createdBy: actorId,
      updatedBy: actorId,
    });
    const savedAttachment = await this.attachmentRepository.save(attachment);

    return {
      attachmentId: savedAttachment.id,
      ...signature,
      overwrite: 'false',
      allowedFormats: 'jpg,png,webp,pdf',
      maxFileBytes: MAX_FILE_BYTES,
    };
  }

  async confirmUpload(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    attachmentId: Uuid,
    actorId: Uuid,
  ): Promise<TaskAttachmentResDto> {
    await this.assertTaskAccess(workspaceId, projectId, taskId, actorId);
    const attachment = await this.attachmentRepository.findOneBy({
      id: attachmentId,
      taskId,
      createdBy: actorId,
      status: TaskAttachmentStatus.PENDING,
    });
    if (!attachment) {
      throw new NotFoundException('Pending task attachment not found.');
    }
    if (
      Date.now() - attachment.createdAt.getTime() >
      SIGNATURE_MAX_AGE_MILLISECONDS
    ) {
      await this.cloudinaryService.deleteAsset(
        attachment.publicId,
        attachment.resourceType,
      );
      await this.attachmentRepository.remove(attachment);
      throw new GoneException('The Cloudinary upload signature has expired.');
    }

    const asset = await this.cloudinaryService.verifyUploadedAsset(
      attachment.publicId,
      attachment.resourceType,
    );
    const allowedFormats =
      CONTENT_TYPE_FORMATS[attachment.contentType as TaskAttachmentContentType];
    if (
      asset.bytes < 1 ||
      asset.bytes > MAX_FILE_BYTES ||
      !allowedFormats?.includes(asset.format)
    ) {
      await this.cloudinaryService.deleteAsset(
        attachment.publicId,
        attachment.resourceType,
      );
      await this.attachmentRepository.remove(attachment);
      throw new BadRequestException(
        'Uploaded file type or size does not meet the attachment limits.',
      );
    }

    attachment.sizeBytes = asset.bytes;
    attachment.format = asset.format;
    attachment.status = TaskAttachmentStatus.ACTIVE;
    attachment.updatedBy = actorId;
    const savedAttachment = await this.attachmentRepository.save(attachment);
    return this.toDto(savedAttachment);
  }

  async findTaskAttachments(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<TaskAttachmentResDto[]> {
    await this.assertTaskAccess(workspaceId, projectId, taskId, actorId);
    const attachments = await this.attachmentRepository.find({
      where: { taskId, status: TaskAttachmentStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });
    return attachments.map((attachment) => this.toDto(attachment));
  }

  async deleteTaskAttachment(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    attachmentId: Uuid,
    actorId: Uuid,
  ): Promise<void> {
    await this.assertTaskAccess(workspaceId, projectId, taskId, actorId);
    const attachment = await this.attachmentRepository.findOneBy({
      id: attachmentId,
      taskId,
    });
    if (!attachment) {
      throw new NotFoundException('Task attachment not found.');
    }

    await this.cloudinaryService.deleteAsset(
      attachment.publicId,
      attachment.resourceType,
    );
    await this.attachmentRepository.remove(attachment);
  }

  async deleteAllForTask(taskId: Uuid): Promise<void> {
    const attachments = await this.attachmentRepository.find({
      where: { taskId },
    });
    for (const attachment of attachments) {
      await this.cloudinaryService.deleteAsset(
        attachment.publicId,
        attachment.resourceType,
      );
    }
    if (attachments.length > 0) {
      await this.attachmentRepository.remove(attachments);
    }
  }

  private async assertTaskAccess(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<void> {
    const isProjectMember = await this.projectMemberRepository.exists({
      where: { projectId, userId: actorId, project: { workspaceId } },
    });
    if (!isProjectMember) {
      throw new NotFoundException('Project not found.');
    }

    const taskExists = await this.taskRepository.exists({
      where: { id: taskId, projectId, project: { workspaceId } },
    });
    if (!taskExists) {
      throw new NotFoundException('Task not found.');
    }
  }

  private normalizeFileName(fileName: string): string {
    const normalized = fileName.trim().split(/[\\/]/).pop()?.trim();
    if (!normalized) {
      throw new BadRequestException('A file name is required.');
    }
    return normalized.slice(0, 255);
  }

  private toDto(attachment: TaskAttachmentEntity): TaskAttachmentResDto {
    if (attachment.sizeBytes === null || !attachment.format) {
      throw new BadRequestException(
        'Only confirmed task attachments can be returned.',
      );
    }

    return {
      id: attachment.id,
      fileName: attachment.originalFilename,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      format: attachment.format,
      downloadUrl: this.cloudinaryService.createDeliveryUrl(
        attachment.publicId,
        attachment.format,
        attachment.resourceType,
      ),
      createdAt: attachment.createdAt,
    };
  }
}
