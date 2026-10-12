import { Uuid } from '@/common/types/common.type';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const repository = {
    count: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: repository,
        },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('lists only the current user notifications with a bounded page size', async () => {
    repository.find.mockResolvedValue([]);

    await expect(service.findAll('user-id' as Uuid)).resolves.toEqual([]);
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientUserId: 'user-id' },
        take: 50,
      }),
    );
  });

  it('counts only unread notifications belonging to the current user', async () => {
    repository.count.mockResolvedValue(3);

    await expect(service.unreadCount('user-id' as Uuid)).resolves.toBe(3);
    expect(repository.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipientUserId: 'user-id' }),
      }),
    );
  });

  it('marks an owned notification as read and rejects another users notification', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'notification-id',
      recipientUserId: 'user-id',
      readAt: null,
    });
    repository.save.mockImplementation(
      async (notification: object) => notification,
    );

    await service.markRead('user-id' as Uuid, 'notification-id' as Uuid);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user-id',
        readAt: expect.any(Date),
      }),
    );

    repository.findOneBy.mockResolvedValue(null);
    await expect(
      service.markRead('user-id' as Uuid, 'other-id' as Uuid),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks only the current user unread notifications as read', async () => {
    await service.markAllRead('user-id' as Uuid);

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user-id',
      }),
      expect.objectContaining({ readAt: expect.any(Date) }),
    );
  });
});
