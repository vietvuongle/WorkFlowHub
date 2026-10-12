import { Uuid } from '@/common/types/common.type';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { IsNull, Repository } from 'typeorm';
import { NotificationResDto } from './dto/notification.res.dto';
import { NotificationEntity } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  async findAll(userId: Uuid): Promise<NotificationResDto[]> {
    const notifications = await this.notificationRepository.find({
      where: { recipientUserId: userId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 50,
    });
    return plainToInstance(NotificationResDto, notifications);
  }

  async unreadCount(userId: Uuid): Promise<number> {
    return this.notificationRepository.count({
      where: { recipientUserId: userId, readAt: IsNull() },
    });
  }

  async markRead(userId: Uuid, notificationId: Uuid): Promise<void> {
    const notification = await this.notificationRepository.findOneBy({
      id: notificationId,
      recipientUserId: userId,
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.readAt === null) {
      notification.readAt = new Date();
      notification.updatedBy = userId;
      await this.notificationRepository.save(notification);
    }
  }

  async markAllRead(userId: Uuid): Promise<void> {
    await this.notificationRepository.update(
      { recipientUserId: userId, readAt: IsNull() },
      { readAt: new Date(), updatedBy: userId },
    );
  }
}
