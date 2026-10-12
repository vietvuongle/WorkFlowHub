import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module';
import { RedisLockModule } from '../../redis/redis.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import { ProjectEntity } from '../project/entities/project.entity';
import { WorkspaceMemberEntity } from '../workspace/entities/workspace-member.entity';
import { WorkspacePermissionGuard } from '../workspace/guards/workspace-permission.guard';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TaskAttachmentEntity } from './entities/task-attachment.entity';
import { TaskDependencyEntity } from './entities/task-dependency.entity';
import { TaskEntity } from './entities/task.entity';
import { WorkLogEntity } from './entities/work-log.entity';
import { TaskAttachmentController } from './task-attachment.controller';
import { TaskAttachmentService } from './task-attachment.service';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [
    WorkspaceModule,
    CollaborationModule,
    CloudinaryModule,
    RedisLockModule,
    TypeOrmModule.forFeature([
      WorkspaceMemberEntity,
      ProjectEntity,
      ProjectMemberEntity,
      TaskEntity,
      TaskDependencyEntity,
      WorkLogEntity,
      TaskAttachmentEntity,
    ]),
  ],
  controllers: [TaskController, TaskAttachmentController],
  providers: [TaskService, TaskAttachmentService, WorkspacePermissionGuard],
})
export class TaskModule {}
