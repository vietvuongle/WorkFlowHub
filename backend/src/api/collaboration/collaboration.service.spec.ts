import { Uuid } from '@/common/types/common.type';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import { TaskEntity } from '../task/entities/task.entity';
import { CollaborationService } from './collaboration.service';
import { NotificationEntity } from './entities/notification.entity';
import { TaskCommentEntity } from './entities/task-comment.entity';
import { CollaborationGateway } from './realtime/collaboration.gateway';

function createRepositoryMock() {
  return {
    create: jest.fn((data: object) => data),
    exists: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
}

describe('CollaborationService', () => {
  let service: CollaborationService;
  let projectMemberRepository: ReturnType<typeof createRepositoryMock>;
  let taskRepository: ReturnType<typeof createRepositoryMock>;
  let commentRepository: ReturnType<typeof createRepositoryMock>;
  let notificationRepository: ReturnType<typeof createRepositoryMock>;
  let gateway: { publishNotification: jest.Mock };

  beforeEach(async () => {
    projectMemberRepository = createRepositoryMock();
    taskRepository = createRepositoryMock();
    commentRepository = createRepositoryMock();
    notificationRepository = createRepositoryMock();
    gateway = { publishNotification: jest.fn() };

    const repositories = new Map<
      unknown,
      ReturnType<typeof createRepositoryMock>
    >([
      [TaskCommentEntity, commentRepository],
      [NotificationEntity, notificationRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
    };
    Object.assign(commentRepository, {
      manager: {
        transaction: jest.fn(
          (callback: (transactionManager: typeof manager) => unknown) =>
            callback(manager),
        ),
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationService,
        {
          provide: getRepositoryToken(ProjectMemberEntity),
          useValue: projectMemberRepository,
        },
        {
          provide: getRepositoryToken(TaskEntity),
          useValue: taskRepository,
        },
        {
          provide: getRepositoryToken(TaskCommentEntity),
          useValue: commentRepository,
        },
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: notificationRepository,
        },
        { provide: CollaborationGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(CollaborationService);
  });

  it('lists comments only after confirming task project access', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    taskRepository.exists.mockResolvedValue(true);
    commentRepository.find.mockResolvedValue([]);

    await expect(
      service.findTaskComments(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'task-id' as Uuid,
        'user-id' as Uuid,
      ),
    ).resolves.toEqual([]);
    expect(commentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taskId: 'task-id' } }),
    );
  });

  it('creates comments and persists then emits notifications to mentioned project members', async () => {
    const comment = {
      id: 'comment-id',
      taskId: 'task-id',
      authorUserId: 'author-id',
      content: '  Please review this  ',
      mentionedUserIds: ['mentioned-id'],
      createdAt: new Date('2026-10-10T00:00:00.000Z'),
    };
    projectMemberRepository.exists.mockResolvedValue(true);
    projectMemberRepository.find.mockResolvedValue([
      { userId: 'mentioned-id' },
    ]);
    taskRepository.findOneBy.mockResolvedValue({
      id: 'task-id',
      key: 'APP-1',
    });
    commentRepository.save.mockImplementation(async (data: object) => ({
      ...data,
      id: comment.id,
      createdAt: comment.createdAt,
    }));
    notificationRepository.create.mockImplementation((data: object) => data);
    notificationRepository.save.mockImplementation(
      async (notifications: object[]) =>
        notifications.map((notification) => ({
          ...notification,
          id: 'notification-id',
          createdAt: comment.createdAt,
        })),
    );

    const result = await service.createTaskComment(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'task-id' as Uuid,
      'author-id' as Uuid,
      {
        content: '  Please review this  ',
        mentionedUserIds: ['mentioned-id'],
      },
    );

    expect(result.content).toBe('Please review this');
    expect(commentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ mentionedUserIds: ['mentioned-id'] }),
    );
    expect(notificationRepository.save).toHaveBeenCalled();
    expect(gateway.publishNotification).toHaveBeenCalledWith(
      'mentioned-id',
      expect.objectContaining({ id: 'notification-id' }),
    );
  });

  it('rejects mentions to users outside the project', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    projectMemberRepository.find.mockResolvedValue([]);
    taskRepository.findOneBy.mockResolvedValue({
      id: 'task-id',
      key: 'APP-1',
    });

    await expect(
      service.createTaskComment(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'task-id' as Uuid,
        'author-id' as Uuid,
        { content: 'Review this', mentionedUserIds: ['outside-user'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(commentRepository.save).not.toHaveBeenCalled();
  });

  it('rejects comments when the task is not in the requested project', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    taskRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.createTaskComment(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'task-id' as Uuid,
        'author-id' as Uuid,
        { content: 'Review this', mentionedUserIds: [] },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
