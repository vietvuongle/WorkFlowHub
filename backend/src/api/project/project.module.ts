import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMemberEntity } from '../workspace/entities/workspace-member.entity';
import { WorkspacePermissionGuard } from '../workspace/guards/workspace-permission.guard';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ProjectMemberEntity } from './entities/project-member.entity';
import { ProjectWorkflowEntity } from './entities/project-workflow.entity';
import { ProjectEntity } from './entities/project.entity';
import { WorkflowStatusEntity } from './entities/workflow-status.entity';
import { WorkflowTransitionEntity } from './entities/workflow-transition.entity';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

@Module({
  imports: [
    WorkspaceModule,
    TypeOrmModule.forFeature([
      ProjectEntity,
      ProjectWorkflowEntity,
      WorkflowStatusEntity,
      WorkflowTransitionEntity,
      ProjectMemberEntity,
      WorkspaceMemberEntity,
    ]),
  ],
  controllers: [ProjectController],
  providers: [ProjectService, WorkspacePermissionGuard],
})
export class ProjectModule {}
