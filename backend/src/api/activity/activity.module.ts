import { ActivityLogEntity } from '@/database/entities/activity-log.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMemberEntity } from '../workspace/entities/workspace-member.entity';
import { WorkspacePermissionGuard } from '../workspace/guards/workspace-permission.guard';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
  imports: [
    WorkspaceModule,
    TypeOrmModule.forFeature([ActivityLogEntity, WorkspaceMemberEntity]),
  ],
  controllers: [ActivityController],
  providers: [ActivityService, WorkspacePermissionGuard],
})
export class ActivityModule {}
