import { NotFoundException } from '@nestjs/common';
import { ActivityService } from './activity.service';

describe('ActivityService', () => {
  const workspaceMemberRepository = {
    exists: jest.fn(),
  };
  const activityLogRepository = {
    find: jest.fn(),
  };
  const service = new ActivityService(
    workspaceMemberRepository as never,
    activityLogRepository as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('only returns workspace activity to active members', async () => {
    workspaceMemberRepository.exists.mockResolvedValue(false);

    await expect(
      service.findWorkspaceActivity(
        'workspace-id' as never,
        'user-id' as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(activityLogRepository.find).not.toHaveBeenCalled();
  });

  it('returns the newest 100 activity records for an active member', async () => {
    workspaceMemberRepository.exists.mockResolvedValue(true);
    activityLogRepository.find.mockResolvedValue([]);

    await service.findWorkspaceActivity(
      'workspace-id' as never,
      'user-id' as never,
    );

    expect(workspaceMemberRepository.exists).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-id',
        userId: 'user-id',
        status: 'ACTIVE',
      },
    });
    expect(activityLogRepository.find).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-id' },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 100,
    });
  });
});
