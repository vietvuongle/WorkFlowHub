import { Uuid } from '@/common/types/common.type';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceAccessService } from './workspace-access.service';

describe('WorkspaceAccessService', () => {
  const workspaceRepository = {
    findOneBy: jest.fn(),
  };
  const userRepository = {
    findOne: jest.fn(),
  };
  const roleRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const permissionRepository = {
    find: jest.fn(),
    findBy: jest.fn(),
  };
  const memberRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const service = new WorkspaceAccessService(
    workspaceRepository as never,
    userRepository as never,
    roleRepository as never,
    permissionRepository as never,
    memberRepository as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prevents non-owners from assigning roles with owner-only permissions', async () => {
    memberRepository.findOne.mockResolvedValue({
      userId: 'member-id',
      roleId: 'member-role-id',
      user: { email: 'member@example.com' },
      role: { permissions: [] },
    });
    roleRepository.findOne.mockResolvedValue({
      id: 'elevated-role-id',
      name: 'Custom Admin',
      permissions: [{ code: 'roles.manage' }],
    });
    workspaceRepository.findOneBy.mockResolvedValue({
      id: 'workspace-id',
      ownerId: 'owner-id',
    });

    await expect(
      service.updateMemberRole(
        'workspace-id' as Uuid,
        'member-record-id' as Uuid,
        'admin-id' as Uuid,
        { roleId: 'elevated-role-id' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberRepository.save).not.toHaveBeenCalled();
  });
});
