import { Uuid } from '@/common/types/common.type';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateWorkspaceReqDto } from './dto/create-workspace.req.dto';
import { PermissionEntity } from './entities/permission.entity';
import { RoleEntity } from './entities/role.entity';
import { WorkspaceMemberEntity } from './entities/workspace-member.entity';
import { WorkspaceEntity } from './entities/workspace.entity';
import { WorkspaceService } from './workspace.service';

function createWorkspaceRepositoryMock() {
  return {
    create: jest.fn((data: object) => data),
    save: jest.fn(async (workspace: object) => workspace),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    remove: jest.fn(),
    exists: jest.fn(),
    manager: { transaction: jest.fn() },
  };
}

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let repository: ReturnType<typeof createWorkspaceRepositoryMock>;
  let memberRepository: ReturnType<typeof createWorkspaceRepositoryMock>;
  let roleRepository: ReturnType<typeof createWorkspaceRepositoryMock>;
  let permissionRepository: { find: jest.Mock };

  beforeEach(async () => {
    repository = createWorkspaceRepositoryMock();
    repository.save.mockImplementation(async (workspace: object) => ({
      ...workspace,
      id: 'workspace-id',
    }));
    roleRepository = createWorkspaceRepositoryMock();
    roleRepository.save.mockImplementation(async (roles: object | object[]) =>
      Array.isArray(roles) ? roles : { ...roles, id: 'owner-role-id' },
    );
    memberRepository = createWorkspaceRepositoryMock();
    permissionRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'p1', code: 'workspace.read' },
        { id: 'p2', code: 'workspace.update' },
        { id: 'p3', code: 'workspace.delete' },
        { id: 'p4', code: 'members.read' },
        { id: 'p5', code: 'members.manage' },
        { id: 'p6', code: 'roles.read' },
        { id: 'p7', code: 'roles.manage' },
        { id: 'p8', code: 'projects.read' },
        { id: 'p9', code: 'projects.manage' },
        { id: 'p10', code: 'workflow.manage' },
        { id: 'p11', code: 'tasks.read' },
        { id: 'p12', code: 'tasks.manage' },
        { id: 'p13', code: 'activity.read' },
      ]),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === WorkspaceEntity) return repository;
        if (entity === RoleEntity) return roleRepository;
        if (entity === WorkspaceMemberEntity) return memberRepository;
        if (entity === PermissionEntity) return permissionRepository;
        throw new Error('Unexpected repository');
      }),
    };
    repository.manager = {
      transaction: jest.fn(
        (callback: (transactionManager: typeof manager) => unknown) =>
          callback(manager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: repository,
        },
        {
          provide: getRepositoryToken(WorkspaceMemberEntity),
          useValue: memberRepository,
        },
      ],
    }).compile();

    service = module.get(WorkspaceService);
  });

  it('creates a workspace with a normalized unique slug', async () => {
    repository.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const dto = {
      name: '  Café Design Team  ',
      description: '  Product workspace  ',
    } satisfies CreateWorkspaceReqDto;

    const result = await service.create('owner-id' as Uuid, dto);

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Café Design Team',
      slug: 'cafe-design-team-2',
      description: 'Product workspace',
      ownerId: 'owner-id',
      createdBy: 'owner-id',
      updatedBy: 'owner-id',
    });
    expect(result.slug).toBe('cafe-design-team-2');
    expect(memberRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-id',
        userId: 'owner-id',
        roleId: 'owner-role-id',
      }),
    );
  });

  it('loads a workspace by ID after the permission guard authorizes access', async () => {
    repository.findOneBy.mockResolvedValue({ id: 'workspace-id' });

    await expect(service.findOne('workspace-id' as Uuid)).resolves.toEqual(
      expect.objectContaining({ id: 'workspace-id' }),
    );
    expect(repository.findOneBy).toHaveBeenCalledWith({
      id: 'workspace-id',
    });
  });
});
