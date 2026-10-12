import { NotFoundException } from '@nestjs/common';
import { SprintStatus } from '../sprint/entities/sprint.entity';
import { TaskStatus } from '../task/entities/task.entity';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const projectMemberRepository = { exists: jest.fn() };
  const taskRepository = {
    query: jest.fn(),
    find: jest.fn(),
  };
  const sprintRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const workLogRepository = { find: jest.fn() };
  const service = new AnalyticsService(
    projectMemberRepository as never,
    taskRepository as never,
    sprintRepository as never,
    workLogRepository as never,
  );
  const workspaceId = 'workspace-id' as never;
  const projectId = 'project-id' as never;
  const actorId = 'actor-id' as never;

  beforeEach(() => {
    jest.clearAllMocks();
    projectMemberRepository.exists.mockResolvedValue(true);
  });

  it('aggregates project task counts, estimates, work and completion percentage', async () => {
    taskRepository.query.mockResolvedValue([
      {
        status: TaskStatus.TODO,
        taskCount: 1,
        estimateMinutes: 120,
        loggedMinutes: 30,
        remainingMinutes: 90,
      },
      {
        status: TaskStatus.DONE,
        taskCount: 1,
        estimateMinutes: 60,
        loggedMinutes: 60,
        remainingMinutes: 0,
      },
    ]);

    await expect(
      service.getProjectSummary(workspaceId, projectId, actorId),
    ).resolves.toMatchObject({
      totalTasks: 2,
      completedTasks: 1,
      completionPercent: 50,
      estimatedHours: 3,
      loggedHours: 1.5,
      remainingHours: 1.5,
      byStatus: expect.arrayContaining([
        { status: TaskStatus.TODO, count: 1 },
        { status: TaskStatus.DONE, count: 1 },
        { status: TaskStatus.CANCELLED, count: 0 },
      ]),
    });
    expect(taskRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE "project_id" = $1'),
      [projectId],
    );
  });

  it('calculates average velocity from completed sprints only', async () => {
    sprintRepository.find.mockResolvedValue([
      {
        id: 'sprint-1',
        name: 'Sprint 1',
        startDate: '2026-10-01',
        endDate: '2026-10-07',
        completedAt: new Date('2026-10-08T00:00:00.000Z'),
      },
      {
        id: 'sprint-2',
        name: 'Sprint 2',
        startDate: '2026-10-08',
        endDate: '2026-10-14',
        completedAt: new Date('2026-10-15T00:00:00.000Z'),
      },
    ]);
    taskRepository.find.mockResolvedValue([
      { sprintId: 'sprint-1', estimateMinutes: 180 },
      { sprintId: 'sprint-1', estimateMinutes: 120 },
      { sprintId: 'sprint-2', estimateMinutes: 240 },
    ]);

    const result = await service.getSprintVelocity(
      workspaceId,
      projectId,
      actorId,
      { limit: 2 },
    );

    expect(sprintRepository.find).toHaveBeenCalledWith({
      where: { projectId, status: SprintStatus.COMPLETED },
      order: { completedAt: 'DESC' },
      take: 2,
    });
    expect(result).toMatchObject({
      sampleSize: 2,
      averageEstimateHours: 4.5,
      sprints: [
        {
          sprintId: 'sprint-1',
          completedTaskCount: 2,
          completedEstimateHours: 5,
        },
        {
          sprintId: 'sprint-2',
          completedTaskCount: 1,
          completedEstimateHours: 4,
        },
      ],
    });
  });

  it('calculates cycle time from task start to the first subsequent completion', async () => {
    taskRepository.query.mockResolvedValue([
      { completedTasks: 2, averageDays: 3.25, medianDays: 2.5 },
    ]);

    await expect(
      service.getCycleTime(workspaceId, projectId, actorId),
    ).resolves.toEqual({
      completedTasks: 2,
      averageDays: 3.25,
      medianDays: 2.5,
    });
    expect(taskRepository.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'completion."created_at" >= task_starts."started_at"',
      ),
      [projectId, TaskStatus.IN_PROGRESS, TaskStatus.DONE],
    );
  });

  it('builds daily sprint burndown from work logs and estimate scope', async () => {
    sprintRepository.findOne.mockResolvedValue({
      id: 'sprint-id',
      projectId,
      startDate: '2026-10-01',
      endDate: '2026-10-03',
    });
    taskRepository.find.mockResolvedValue([
      { id: 'task-1', estimateMinutes: 600 },
      { id: 'task-2', estimateMinutes: 300 },
    ]);
    workLogRepository.find.mockResolvedValue([
      { workDate: '2026-10-01', durationMinutes: 120 },
      { workDate: '2026-10-03', durationMinutes: 180 },
    ]);

    const result = await service.getSprintBurndown(
      workspaceId,
      projectId,
      'sprint-id' as never,
      actorId,
    );

    expect(result).toEqual({
      sprintId: 'sprint-id',
      scopeEstimateHours: 15,
      points: [
        {
          date: '2026-10-01',
          idealRemainingHours: 15,
          actualRemainingHours: 13,
        },
        {
          date: '2026-10-02',
          idealRemainingHours: 7.5,
          actualRemainingHours: 13,
        },
        {
          date: '2026-10-03',
          idealRemainingHours: 0,
          actualRemainingHours: 10,
        },
      ],
    });
    expect(workLogRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workDate: expect.anything(),
        }),
      }),
    );
  });

  it('does not expose analytics to users outside the project', async () => {
    projectMemberRepository.exists.mockResolvedValue(false);

    await expect(
      service.getProjectSummary(workspaceId, projectId, actorId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(taskRepository.query).not.toHaveBeenCalled();
  });

  it('returns not found for a sprint outside the requested project', async () => {
    sprintRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getSprintBurndown(
        workspaceId,
        projectId,
        'sprint-id' as never,
        actorId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(taskRepository.find).not.toHaveBeenCalled();
  });
});
