import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import { SprintEntity } from '../sprint/entities/sprint.entity';
import { TaskEntity } from '../task/entities/task.entity';
import { WorkLogEntity } from '../task/entities/work-log.entity';
import { WorkspaceMemberEntity } from '../workspace/entities/workspace-member.entity';
import { WorkspacePermissionGuard } from '../workspace/guards/workspace-permission.guard';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    WorkspaceModule,
    TypeOrmModule.forFeature([
      ProjectMemberEntity,
      SprintEntity,
      TaskEntity,
      WorkLogEntity,
      WorkspaceMemberEntity,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, WorkspacePermissionGuard],
})
export class AnalyticsModule {}
