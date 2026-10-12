import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WORKSPACE_PERMISSION_METADATA,
  WorkspacePermission,
} from '../constants/workspace-permission.constant';
import {
  WorkspaceMemberEntity,
  WorkspaceMemberStatus,
} from '../entities/workspace-member.entity';

@Injectable()
export class WorkspacePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly memberRepository: Repository<WorkspaceMemberEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      WorkspacePermission[]
    >(WORKSPACE_PERMISSION_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const workspaceId = request.params.workspaceId ?? request.params.id;
    const userId = request.user?.id;

    if (!workspaceId || !userId) {
      throw new ForbiddenException('Workspace access is required');
    }

    const member = await this.memberRepository.findOne({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      relations: { role: { permissions: true } },
    });

    const granted = new Set(member?.role.permissions.map(({ code }) => code));
    if (
      !member ||
      !requiredPermissions.every((permission) => granted.has(permission))
    ) {
      throw new ForbiddenException('Insufficient workspace permissions');
    }

    request.workspaceMember = member;
    return true;
  }
}
