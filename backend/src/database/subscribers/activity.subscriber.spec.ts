import { ActivityLogEntity } from '@/database/entities/activity-log.entity';
import { InsertEvent } from 'typeorm';
import { ActivitySubscriber } from './activity.subscriber';

describe('ActivitySubscriber', () => {
  it('writes task creation activity in the same manager context', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({
        id: 'project-id',
        workspaceId: 'workspace-id',
      }),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    const subscriber = new ActivitySubscriber();
    const event = {
      metadata: { name: 'TaskEntity' },
      entity: {
        id: 'task-id',
        projectId: 'project-id',
        title: 'Task title',
        status: 'TODO',
        createdBy: 'user-id',
        updatedBy: 'user-id',
      },
      manager,
    } as unknown as InsertEvent<unknown>;

    await subscriber.afterInsert(event);

    expect(manager.insert).toHaveBeenCalledWith(
      ActivityLogEntity,
      expect.objectContaining({
        workspaceId: 'workspace-id',
        projectId: 'project-id',
        taskId: 'task-id',
        entityType: 'TASK',
        entityId: 'task-id',
        action: 'created',
        actorId: 'user-id',
        metadata: { title: 'Task title', status: 'TODO' },
      }),
    );
  });
});
