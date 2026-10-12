import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { PermissionEntity } from './entities/permission.entity';
import { RoleEntity } from './entities/role.entity';
import { WorkspaceMemberEntity } from './entities/workspace-member.entity';
import { WorkspaceEntity } from './entities/workspace.entity';
import { WorkspacePermissionGuard } from './guards/workspace-permission.guard';
import { WorkspaceAccessController } from './workspace-access.controller';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PermissionEntity,
      RoleEntity,
      UserEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
    ]),
  ],
  controllers: [WorkspaceController, WorkspaceAccessController],
  providers: [
    WorkspaceService,
    WorkspaceAccessService,
    WorkspacePermissionGuard,
  ],
  exports: [WorkspacePermissionGuard],
})
export class WorkspaceModule {}
