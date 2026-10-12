import { AuthModule } from '@/api/auth/auth.module';
import { ProjectMemberEntity } from '@/api/project/entities/project-member.entity';
import { TaskEntity } from '@/api/task/entities/task.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationService } from './collaboration.service';
import { NotificationEntity } from './entities/notification.entity';
import { TaskCommentEntity } from './entities/task-comment.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { CollaborationGateway } from './realtime/collaboration.gateway';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ProjectMemberEntity,
      TaskEntity,
      TaskCommentEntity,
      NotificationEntity,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [CollaborationService, NotificationsService, CollaborationGateway],
  exports: [CollaborationService],
})
export class CollaborationModule {}
