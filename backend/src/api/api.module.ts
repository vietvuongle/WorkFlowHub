import { Module } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { HealthModule } from './health/health.module';
import { HomeModule } from './home/home.module';
import { PostModule } from './post/post.module';
import { ProjectModule } from './project/project.module';
import { SprintModule } from './sprint/sprint.module';
import { TaskModule } from './task/task.module';
import { UserModule } from './user/user.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [
    UserModule,
    HealthModule,
    AuthModule,
    HomeModule,
    PostModule,
    WorkspaceModule,
    ProjectModule,
    TaskModule,
    SprintModule,
    CollaborationModule,
    ActivityModule,
    AnalyticsModule,
  ],
})
export class ApiModule {}
