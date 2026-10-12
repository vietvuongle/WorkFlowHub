import { UserEntity } from '@/api/user/entities/user.entity';
import { Uuid } from '@/common/types/common.type';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { In, QueryFailedError, Repository } from 'typeorm';
import { AddWorkspaceMemberReqDto } from './dto/add-workspace-member.req.dto';
import { CreateWorkspaceRoleReqDto } from './dto/create-workspace-role.req.dto';
import { PermissionResDto } from './dto/permission.res.dto';
import { UpdateWorkspaceMemberRoleReqDto } from './dto/update-workspace-member-role.req.dto';
import { UpdateWorkspaceMemberStatusReqDto } from './dto/update-workspace-member-status.req.dto';
import { UpdateWorkspaceRoleReqDto } from './dto/update-workspace-role.req.dto';
import { WorkspaceMemberResDto } from './dto/workspace-member.res.dto';
import { WorkspaceRoleResDto } from './dto/workspace-role.res.dto';
import { PermissionEntity } from './entities/permission.entity';
import { RoleEntity } from './entities/role.entity';
import {
  WorkspaceMemberEntity,
  WorkspaceMemberStatus,
} from './entities/workspace-member.entity';
import { WorkspaceEntity } from './entities/workspace.entity';

@Injectable()
export class WorkspaceAccessService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly memberRepository: Repository<WorkspaceMemberEntity>,
  ) {}

  async findPermissions(): Promise<PermissionResDto[]> {
    const permissions = await this.permissionRepository.find({
      order: { code: 'ASC' },
    });
    return plainToInstance(PermissionResDto, permissions);
  }

  async findRoles(workspaceId: Uuid): Promise<WorkspaceRoleResDto[]> {
    await this.findWorkspace(workspaceId);
    const roles = await this.roleRepository.find({
      where: { workspaceId },
      relations: { permissions: true },
      order: { name: 'ASC' },
    });
    return plainToInstance(WorkspaceRoleResDto, roles);
  }

  async createRole(
    workspaceId: Uuid,
    actorId: Uuid,
    reqDto: CreateWorkspaceRoleReqDto,
  ): Promise<WorkspaceRoleResDto> {
    await this.findWorkspace(workspaceId);
    const permissions = await this.findPermissionsByCodes(
      reqDto.permissionCodes,
    );
    const role = this.roleRepository.create({
      workspaceId,
      name: reqDto.name.trim(),
      description: reqDto.description?.trim() || null,
      isSystem: false,
      permissions,
      createdBy: actorId,
      updatedBy: actorId,
    });

    try {
      return plainToInstance(
        WorkspaceRoleResDto,
        await this.roleRepository.save(role),
      );
    } catch (error) {
      this.throwIfDuplicateRoleName(error);
      throw error;
    }
  }

  async updateRole(
    workspaceId: Uuid,
    roleId: Uuid,
    actorId: Uuid,
    reqDto: UpdateWorkspaceRoleReqDto,
  ): Promise<WorkspaceRoleResDto> {
    const role = await this.findRole(workspaceId, roleId);
    if (role.isSystem) {
      throw new ConflictException('System roles cannot be changed');
    }

    if (reqDto.name !== undefined) {
      role.name = reqDto.name.trim();
    }
    if (reqDto.description !== undefined) {
      role.description = reqDto.description.trim() || null;
    }
    if (reqDto.permissionCodes !== undefined) {
      role.permissions = await this.findPermissionsByCodes(
        reqDto.permissionCodes,
      );
    }
    role.updatedBy = actorId;

    try {
      return plainToInstance(
        WorkspaceRoleResDto,
        await this.roleRepository.save(role),
      );
    } catch (error) {
      this.throwIfDuplicateRoleName(error);
      throw error;
    }
  }

  async findMembers(workspaceId: Uuid): Promise<WorkspaceMemberResDto[]> {
    await this.findWorkspace(workspaceId);
    const members = await this.memberRepository.find({
      where: { workspaceId },
      relations: { user: true, role: { permissions: true } },
      order: { createdAt: 'ASC' },
    });
    return members.map((member) =>
      plainToInstance(WorkspaceMemberResDto, {
        ...member,
        email: member.user.email,
        username: member.user.username,
      }),
    );
  }

  async addMember(
    workspaceId: Uuid,
    actorId: Uuid,
    reqDto: AddWorkspaceMemberReqDto,
  ): Promise<WorkspaceMemberResDto> {
    const workspace = await this.findWorkspace(workspaceId);
    const [user, role] = await Promise.all([
      this.userRepository.findOne({ where: { email: reqDto.email } }),
      this.findRole(workspaceId, reqDto.roleId as Uuid),
    ]);

    if (!user) {
      throw new NotFoundException(
        'User not found; only registered users can be added',
      );
    }
    if (role.name === 'Owner') {
      throw new ConflictException('The Owner role cannot be assigned');
    }
    this.assertAssignableRole(role, workspace, actorId);

    const member = this.memberRepository.create({
      workspaceId,
      userId: user.id,
      roleId: role.id,
      status: WorkspaceMemberStatus.ACTIVE,
      joinedAt: new Date(),
      createdBy: actorId,
      updatedBy: actorId,
    });

    try {
      const saved = await this.memberRepository.save(member);
      saved.user = user;
      saved.role = role;
      return this.toMemberDto(saved);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError?.code === '23505' &&
        error.driverError?.constraint === 'UQ_workspace_members_workspace_user'
      ) {
        throw new ConflictException('User is already a workspace member');
      }
      throw error;
    }
  }

  async updateMemberRole(
    workspaceId: Uuid,
    memberId: Uuid,
    actorId: Uuid,
    reqDto: UpdateWorkspaceMemberRoleReqDto,
  ): Promise<WorkspaceMemberResDto> {
    const [member, role, workspace] = await Promise.all([
      this.findMember(workspaceId, memberId),
      this.findRole(workspaceId, reqDto.roleId as Uuid),
      this.findWorkspace(workspaceId),
    ]);
    this.assertNotOwner(member, workspace);
    if (role.name === 'Owner') {
      throw new ConflictException('The Owner role cannot be assigned');
    }
    this.assertAssignableRole(role, workspace, actorId);

    member.roleId = role.id;
    member.role = role;
    member.updatedBy = actorId;
    return this.toMemberDto(await this.memberRepository.save(member));
  }

  async updateMemberStatus(
    workspaceId: Uuid,
    memberId: Uuid,
    actorId: Uuid,
    reqDto: UpdateWorkspaceMemberStatusReqDto,
  ): Promise<WorkspaceMemberResDto> {
    const [member, workspace] = await Promise.all([
      this.findMember(workspaceId, memberId),
      this.findWorkspace(workspaceId),
    ]);
    this.assertNotOwner(member, workspace);
    member.status = reqDto.status;
    if (reqDto.status === WorkspaceMemberStatus.ACTIVE && !member.joinedAt) {
      member.joinedAt = new Date();
    }
    member.updatedBy = actorId;
    return this.toMemberDto(await this.memberRepository.save(member));
  }

  private async findWorkspace(workspaceId: Uuid): Promise<WorkspaceEntity> {
    const workspace = await this.workspaceRepository.findOneBy({
      id: workspaceId,
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }

  private async findRole(workspaceId: Uuid, roleId: Uuid): Promise<RoleEntity> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId, workspaceId },
      relations: { permissions: true },
    });
    if (!role) {
      throw new NotFoundException('Workspace role not found');
    }
    return role;
  }

  private async findMember(
    workspaceId: Uuid,
    memberId: Uuid,
  ): Promise<WorkspaceMemberEntity> {
    const member = await this.memberRepository.findOne({
      where: { id: memberId, workspaceId },
      relations: { user: true, role: { permissions: true } },
    });
    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }
    return member;
  }

  private async findPermissionsByCodes(
    codes: string[],
  ): Promise<PermissionEntity[]> {
    const permissions = codes.length
      ? await this.permissionRepository.findBy({ code: In(codes) })
      : [];
    if (permissions.length !== new Set(codes).size) {
      throw new BadRequestException('One or more permission codes are invalid');
    }
    return permissions;
  }

  private assertNotOwner(
    member: WorkspaceMemberEntity,
    workspace: WorkspaceEntity,
  ): void {
    if (member.userId === workspace.ownerId) {
      throw new ConflictException('The workspace owner cannot be modified');
    }
  }

  private assertAssignableRole(
    role: RoleEntity,
    workspace: WorkspaceEntity,
    actorId: Uuid,
  ): void {
    const grantsSensitivePermission = role.permissions.some(({ code }) =>
      ['roles.manage', 'workspace.delete'].includes(code),
    );
    if (grantsSensitivePermission && workspace.ownerId !== actorId) {
      throw new ForbiddenException(
        'Only the workspace owner can assign this role',
      );
    }
  }

  private toMemberDto(member: WorkspaceMemberEntity): WorkspaceMemberResDto {
    return plainToInstance(WorkspaceMemberResDto, {
      ...member,
      email: member.user.email,
      username: member.user.username,
    });
  }

  private throwIfDuplicateRoleName(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      error.driverError?.code === '23505' &&
      error.driverError?.constraint === 'UQ_roles_workspace_name'
    ) {
      throw new ConflictException('A role with this name already exists');
    }
  }
}
