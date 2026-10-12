import { Uuid } from '@/common/types/common.type';
import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiAuth } from '@/decorators/http.decorators';
import { Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationResDto } from './dto/notification.res.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiAuth({
    type: NotificationResDto,
    isArray: true,
    summary: 'List the current user notifications',
  })
  findAll(@CurrentUser('id') userId: Uuid): Promise<NotificationResDto[]> {
    return this.notificationsService.findAll(userId);
  }

  @Get('unread-count')
  @ApiAuth({ summary: 'Get the current user unread notification count' })
  unreadCount(@CurrentUser('id') userId: Uuid): Promise<number> {
    return this.notificationsService.unreadCount(userId);
  }

  @Patch('read-all')
  @ApiAuth({ summary: 'Mark all current user notifications as read' })
  markAllRead(@CurrentUser('id') userId: Uuid): Promise<void> {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':notificationId/read')
  @ApiAuth({ summary: 'Mark a notification as read' })
  markRead(
    @CurrentUser('id') userId: Uuid,
    @Param('notificationId', ParseUUIDPipe) notificationId: Uuid,
  ): Promise<void> {
    return this.notificationsService.markRead(userId, notificationId);
  }
}
