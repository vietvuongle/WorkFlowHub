import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { WorkspaceMemberEntity } from '../entities/workspace-member.entity';
import { WorkspacePermissionGuard } from './workspace-permission.guard';

describe('WorkspacePermissionGuard', () => {
  const requirements = ['members.manage'];
  const reflectorMock = {
    getAllAndOverride: jest.fn().mockReturnValue(requirements),
  };
  const reflector = reflectorMock as unknown as Reflector;
  const memberRepository = {
    findOne: jest.fn(),
  };
  const guard = new WorkspacePermissionGuard(
    reflector,
    memberRepository as unknown as Repository<WorkspaceMemberEntity>,
  );

  function createContext() {
    const request = {
      params: { workspaceId: 'workspace-id' },
      user: { id: 'user-id' },
    };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    };
    return { context: context as never, request };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    reflectorMock.getAllAndOverride.mockReturnValue(requirements);
  });

  it('allows an active member with the required permission', async () => {
    memberRepository.findOne.mockResolvedValue({
      role: { permissions: [{ code: 'members.manage' }] },
    } as WorkspaceMemberEntity);
    const { context, request } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('workspaceMember');
  });

  it('rejects members without the required permission', async () => {
    memberRepository.findOne.mockResolvedValue({
      role: { permissions: [{ code: 'members.read' }] },
    } as WorkspaceMemberEntity);
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects users who are not active workspace members', async () => {
    memberRepository.findOne.mockResolvedValue(null);
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
