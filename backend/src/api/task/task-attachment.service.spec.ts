import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { Uuid } from '@/common/types/common.type';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  TaskAttachmentEntity,
  TaskAttachmentStatus,
} from './entities/task-attachment.entity';
import { TaskAttachmentService } from './task-attachment.service';

describe('TaskAttachmentService', () => {
  const projectMemberRepository = {
    exists: jest.fn(),
  };
  const taskRepository = {
    exists: jest.fn(),
  };
  const attachmentRepository = {
    create: jest.fn((data: Partial<TaskAttachmentEntity>) => data),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    remove: jest.fn(),
  };
  const cloudinaryService = {
    createUploadSignature: jest.fn(),
    verifyUploadedAsset: jest.fn(),
    createDeliveryUrl: jest.fn(),
    deleteAsset: jest.fn(),
  };
  const service = new TaskAttachmentService(
    projectMemberRepository as never,
    taskRepository as never,
    attachmentRepository as never,
    cloudinaryService as unknown as CloudinaryService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    projectMemberRepository.exists.mockResolvedValue(true);
    taskRepository.exists.mockResolvedValue(true);
    attachmentRepository.save.mockImplementation(
      async (attachment: Partial<TaskAttachmentEntity>) => ({
        ...attachment,
        id: 'attachment-id',
        createdAt: new Date(),
      }),
    );
    cloudinaryService.createUploadSignature.mockReturnValue({
      apiKey: 'public-api-key',
      cloudName: 'cloud-name',
      resourceType: 'raw',
      timestamp: 123,
      signature: 'signature',
      publicId: 'some-public-id',
      deliveryType: 'authenticated',
      uploadUrl: 'https://upload.example',
    });
    cloudinaryService.createDeliveryUrl.mockReturnValue(
      'https://download.example/temporary',
    );
  });

  it('creates a signed, private PDF upload scoped to an authorized task', async () => {
    const result = await service.createUploadSignature(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'task-id' as Uuid,
      'user-id' as Uuid,
      {
        fileName: 'C:\\fakepath\\requirements.pdf',
        contentType: 'application/pdf',
      },
    );

    expect(projectMemberRepository.exists).toHaveBeenCalledWith({
      where: {
        projectId: 'project-id',
        userId: 'user-id',
        project: { workspaceId: 'workspace-id' },
      },
    });
    expect(taskRepository.exists).toHaveBeenCalledWith({
      where: {
        id: 'task-id',
        projectId: 'project-id',
        project: { workspaceId: 'workspace-id' },
      },
    });
    expect(attachmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-id',
        resourceType: 'raw',
        originalFilename: 'requirements.pdf',
        contentType: 'application/pdf',
        status: TaskAttachmentStatus.PENDING,
        createdBy: 'user-id',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        attachmentId: 'attachment-id',
        deliveryType: 'authenticated',
        maxFileBytes: 10 * 1024 * 1024,
      }),
    );
  });

  it('does not create an upload signature for a non-member', async () => {
    projectMemberRepository.exists.mockResolvedValue(false);

    await expect(
      service.createUploadSignature(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'task-id' as Uuid,
        'user-id' as Uuid,
        { fileName: 'photo.png', contentType: 'image/png' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(cloudinaryService.createUploadSignature).not.toHaveBeenCalled();
    expect(attachmentRepository.save).not.toHaveBeenCalled();
  });

  it('confirms valid metadata from Cloudinary and returns an expiring URL', async () => {
    const attachment: Partial<TaskAttachmentEntity> = {
      id: 'attachment-id' as Uuid,
      taskId: 'task-id' as Uuid,
      publicId: 'private/public-id',
      resourceType: 'image',
      originalFilename: 'photo.png',
      contentType: 'image/png',
      sizeBytes: null,
      format: null,
      status: TaskAttachmentStatus.PENDING,
      createdBy: 'user-id',
      createdAt: new Date(),
    };
    attachmentRepository.findOneBy.mockResolvedValue(attachment);
    cloudinaryService.verifyUploadedAsset.mockResolvedValue({
      bytes: 1024,
      format: 'png',
    });

    const result = await service.confirmUpload(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'task-id' as Uuid,
      'attachment-id' as Uuid,
      'user-id' as Uuid,
    );

    expect(attachment.status).toBe(TaskAttachmentStatus.ACTIVE);
    expect(attachmentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ sizeBytes: 1024, format: 'png' }),
    );
    expect(cloudinaryService.createDeliveryUrl).toHaveBeenCalledWith(
      'private/public-id',
      'png',
      'image',
    );
    expect(result.downloadUrl).toBe('https://download.example/temporary');
  });

  it('deletes an uploaded asset that exceeds the configured size limit', async () => {
    const attachment = {
      id: 'attachment-id' as Uuid,
      taskId: 'task-id' as Uuid,
      publicId: 'private/public-id',
      resourceType: 'image' as const,
      originalFilename: 'photo.png',
      contentType: 'image/png',
      sizeBytes: null,
      format: null,
      status: TaskAttachmentStatus.PENDING,
      createdBy: 'user-id',
      createdAt: new Date(),
    };
    attachmentRepository.findOneBy.mockResolvedValue(attachment);
    cloudinaryService.verifyUploadedAsset.mockResolvedValue({
      bytes: 10 * 1024 * 1024 + 1,
      format: 'png',
    });

    await expect(
      service.confirmUpload(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'task-id' as Uuid,
        'attachment-id' as Uuid,
        'user-id' as Uuid,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cloudinaryService.deleteAsset).toHaveBeenCalledWith(
      'private/public-id',
      'image',
    );
    expect(attachmentRepository.remove).toHaveBeenCalledWith(attachment);
  });

  it('removes Cloudinary assets and metadata when a task is deleted', async () => {
    const attachments = [
      {
        publicId: 'private/asset-one',
        resourceType: 'image',
      },
      {
        publicId: 'private/asset-two',
        resourceType: 'raw',
      },
    ];
    attachmentRepository.find.mockResolvedValue(attachments);

    await service.deleteAllForTask('task-id' as Uuid);

    expect(cloudinaryService.deleteAsset).toHaveBeenNthCalledWith(
      1,
      'private/asset-one',
      'image',
    );
    expect(cloudinaryService.deleteAsset).toHaveBeenNthCalledWith(
      2,
      'private/asset-two',
      'raw',
    );
    expect(attachmentRepository.remove).toHaveBeenCalledWith(attachments);
  });

  it('cleans up expired pending uploads before removing their metadata', async () => {
    const attachment = {
      id: 'attachment-id' as Uuid,
      taskId: 'task-id' as Uuid,
      publicId: 'private/expired',
      resourceType: 'raw' as const,
      createdBy: 'user-id',
      createdAt: new Date(Date.now() - 60 * 60 * 1000 - 1),
    };
    attachmentRepository.findOneBy.mockResolvedValue(attachment);

    await expect(
      service.confirmUpload(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'task-id' as Uuid,
        'attachment-id' as Uuid,
        'user-id' as Uuid,
      ),
    ).rejects.toThrow('The Cloudinary upload signature has expired.');
    expect(cloudinaryService.deleteAsset).toHaveBeenCalledWith(
      'private/expired',
      'raw',
    );
    expect(attachmentRepository.remove).toHaveBeenCalledWith(attachment);
  });
});
