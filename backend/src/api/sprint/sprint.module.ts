import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import { ProjectEntity } from '../project/entities/project.entity';
import { TaskEntity } from '../task/entities/task.entity';
import { WorkspaceMemberEntity } from '../workspace/entities/workspace-member.entity';
import { WorkspacePermissionGuard } from '../workspace/guards/workspace-permission.guard';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SprintEntity } from './entities/sprint.entity';
import { SprintController } from './sprint.controller';
import { SprintService } from './sprint.service';

@Module({
  imports: [
    WorkspaceModule,
    TypeOrmModule.forFeature([
      WorkspaceMemberEntity,
      ProjectEntity,
      ProjectMemberEntity,
      TaskEntity,
      SprintEntity,
    ]),
  ],
  controllers: [SprintController],
  providers: [SprintService, WorkspacePermissionGuard],
})
export class SprintModule {}
