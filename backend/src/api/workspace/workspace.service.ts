import { Uuid } from '@/common/types/common.type';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { QueryFailedError, Repository } from 'typeorm';
import { WORKSPACE_PERMISSION_CODES } from './constants/workspace-permission.constant';
import { CreateWorkspaceReqDto } from './dto/create-workspace.req.dto';
import { UpdateWorkspaceReqDto } from './dto/update-workspace.req.dto';
import { WorkspaceResDto } from './dto/workspace.res.dto';
import { PermissionEntity } from './entities/permission.entity';
import { RoleEntity } from './entities/role.entity';
import {
  WorkspaceMemberEntity,
  WorkspaceMemberStatus,
} from './entities/workspace-member.entity';
import { WorkspaceEntity } from './entities/workspace.entity';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly memberRepository: Repository<WorkspaceMemberEntity>,
  ) {}

  async create(
    ownerId: Uuid,
    reqDto: CreateWorkspaceReqDto,
  ): Promise<WorkspaceResDto> {
    const name = reqDto.name.trim();
    const slug = await this.createUniqueSlug(name);
    try {
      return await this.workspaceRepository.manager.transaction(
        async (manager) => {
          const workspaceRepository = manager.getRepository(WorkspaceEntity);
          const roleRepository = manager.getRepository(RoleEntity);
          const memberRepository = manager.getRepository(WorkspaceMemberEntity);
          const permissions = await manager
            .getRepository(PermissionEntity)
            .find();
          const workspace = await workspaceRepository.save(
            workspaceRepository.create({
              name,
              slug,
              description: reqDto.description?.trim() || null,
              ownerId,
              createdBy: ownerId,
              updatedBy: ownerId,
            }),
          );
          const permissionByCode = new Map(
            permissions.map((permission) => [permission.code, permission]),
          );
          if (
            permissions.length !== WORKSPACE_PERMISSION_CODES.length ||
            WORKSPACE_PERMISSION_CODES.some(
              (code) => !permissionByCode.has(code),
            )
          ) {
            throw new InternalServerErrorException(
              'Workspace permissions are not initialized; run database migrations.',
            );
          }

          const permissionsFor = (codes: string[]) =>
            codes.map((code) => permissionByCode.get(code)!);
          const ownerRole = await roleRepository.save(
            roleRepository.create({
              workspaceId: workspace.id,
              name: 'Owner',
              description: 'Workspace owner with full access',
              isSystem: true,
              permissions,
              createdBy: ownerId,
              updatedBy: ownerId,
            }),
          );
          await roleRepository.save([
            roleRepository.create({
              workspaceId: workspace.id,
              name: 'Admin',
              description: 'Workspace administrator',
              isSystem: true,
              permissions: permissionsFor([
                'workspace.read',
                'workspace.update',
                'members.read',
                'members.manage',
                'roles.read',
                'projects.read',
                'projects.manage',
                'workflow.manage',
                'tasks.read',
                'tasks.manage',
                'activity.read',
              ]),
              createdBy: ownerId,
              updatedBy: ownerId,
            }),
            roleRepository.create({
              workspaceId: workspace.id,
              name: 'Member',
              description: 'Standard workspace member',
              isSystem: true,
              permissions: permissionsFor([
                'workspace.read',
                'members.read',
                'roles.read',
                'projects.read',
                'tasks.read',
                'tasks.manage',
                'activity.read',
              ]),
              createdBy: ownerId,
              updatedBy: ownerId,
            }),
          ]);
          await memberRepository.save(
            memberRepository.create({
              workspaceId: workspace.id,
              userId: ownerId,
              roleId: ownerRole.id,
              status: WorkspaceMemberStatus.ACTIVE,
              joinedAt: new Date(),
              createdBy: ownerId,
              updatedBy: ownerId,
            }),
          );

          return this.toDto(workspace);
        },
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError?.code === '23505' &&
        error.driverError?.constraint === 'UQ_workspaces_slug'
      ) {
        throw new ConflictException(
          'Workspace slug was concurrently created; please retry the request.',
        );
      }

      throw error;
    }
  }

  async findAll(ownerId: Uuid): Promise<WorkspaceResDto[]> {
    const memberships = await this.memberRepository.find({
      where: { userId: ownerId, status: WorkspaceMemberStatus.ACTIVE },
      relations: { workspace: true },
      order: { createdAt: 'DESC' },
    });

    return memberships.map((membership) => this.toDto(membership.workspace));
  }

  async findOne(id: Uuid): Promise<WorkspaceResDto> {
    const workspace = await this.findWorkspace(id);
    return this.toDto(workspace);
  }

  async update(
    id: Uuid,
    ownerId: Uuid,
    reqDto: UpdateWorkspaceReqDto,
  ): Promise<WorkspaceResDto> {
    const workspace = await this.findWorkspace(id);

    if (reqDto.name !== undefined) {
      workspace.name = reqDto.name.trim();
    }
    if (reqDto.description !== undefined) {
      workspace.description = reqDto.description.trim() || null;
    }
    workspace.updatedBy = ownerId;

    return this.toDto(await this.workspaceRepository.save(workspace));
  }

  async delete(id: Uuid): Promise<void> {
    const workspace = await this.findWorkspace(id);
    await this.workspaceRepository.remove(workspace);
  }

  private async findWorkspace(id: Uuid): Promise<WorkspaceEntity> {
    const workspace = await this.workspaceRepository.findOneBy({ id });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  private async createUniqueSlug(name: string): Promise<string> {
    const baseSlug =
      name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'workspace';
    let slug = baseSlug;
    let suffix = 2;

    while (await this.workspaceRepository.exists({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private toDto(workspace: WorkspaceEntity): WorkspaceResDto {
    return plainToInstance(WorkspaceResDto, workspace);
  }
}
