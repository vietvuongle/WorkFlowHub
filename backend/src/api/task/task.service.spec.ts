import { Uuid } from '@/common/types/common.type';
import { Order } from '@/constants/app.constant';
import { RedisLockService } from '@/redis/redis-lock.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import { ProjectEntity } from '../project/entities/project.entity';
import { SearchTasksReqDto, TaskSortBy } from './dto/search-tasks.req.dto';
import { TaskDependencyEntity } from './entities/task-dependency.entity';
import { TaskEntity, TaskStatus } from './entities/task.entity';
import { WorkLogEntity } from './entities/work-log.entity';
import { TaskAttachmentService } from './task-attachment.service';
import { TaskService } from './task.service';

function createRepositoryMock() {
  return {
    create: jest.fn((data: object) => data),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    remove: jest.fn(),
    exists: jest.fn(),
    sum: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('TaskService', () => {
  let service: TaskService;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let projectMemberRepository: ReturnType<typeof createRepositoryMock>;
  let taskRepository: ReturnType<typeof createRepositoryMock>;
  let dependencyRepository: ReturnType<typeof createRepositoryMock>;
  let workLogRepository: ReturnType<typeof createRepositoryMock>;
  let transactionManager: { getRepository: jest.Mock };
  let dataSourceValue: { transaction: jest.Mock };

  beforeEach(async () => {
    projectRepository = createRepositoryMock();
    projectMemberRepository = createRepositoryMock();
    taskRepository = createRepositoryMock();
    dependencyRepository = createRepositoryMock();
    workLogRepository = createRepositoryMock();
    const repositories = new Map<
      unknown,
      ReturnType<typeof createRepositoryMock>
    >([
      [ProjectEntity, projectRepository],
      [TaskEntity, taskRepository],
      [TaskDependencyEntity, dependencyRepository],
      [WorkLogEntity, workLogRepository],
    ]);
    transactionManager = {
      getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
    };
    dataSourceValue = {
      transaction: jest.fn(
        (callback: (manager: typeof transactionManager) => unknown) =>
          callback(transactionManager),
      ),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: DataSource, useValue: dataSourceValue },
        {
          provide: RedisLockService,
          useValue: {
            withLock: jest.fn(
              (_key: string, operation: () => Promise<unknown>) => operation(),
            ),
          },
        },
        {
          provide: TaskAttachmentService,
          useValue: { deleteAllForTask: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProjectEntity),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(ProjectMemberEntity),
          useValue: projectMemberRepository,
        },
        {
          provide: getRepositoryToken(TaskEntity),
          useValue: taskRepository,
        },
        {
          provide: getRepositoryToken(TaskDependencyEntity),
          useValue: dependencyRepository,
        },
        {
          provide: getRepositoryToken(WorkLogEntity),
          useValue: workLogRepository,
        },
      ],
    }).compile();

    service = module.get(TaskService);
  });

  it('automatically computes remaining time from estimate minus logged hours', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    taskRepository.findOne.mockResolvedValue({
      id: 'task-id',
      projectId: 'project-id',
      estimateMinutes: 600,
      loggedMinutes: 0,
      remainingMinutes: 600,
    });
    workLogRepository.save.mockImplementation(async (log: object) => ({
      ...log,
      id: 'work-log-id',
      createdAt: new Date('2026-10-10T00:00:00.000Z'),
    }));
    workLogRepository.sum.mockResolvedValue(480);
    taskRepository.save.mockImplementation(async (task: object) => task);

    const result = await service.addWorkLog(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'task-id' as Uuid,
      'user-id' as Uuid,
      {
        workDate: '2026-10-10',
        hours: 8,
        description: 'Implementation',
      },
    );

    expect(result.hours).toBe(8);
    expect(workLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 480 }),
    );
    expect(taskRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ loggedMinutes: 480, remainingMinutes: 120 }),
    );
  });

  it('searches tasks within the authorized project with filters and pagination', async () => {
    const query = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'task-id',
          projectId: 'project-id',
          parentTaskId: 'parent-id',
          sprintId: 'sprint-id',
          number: 2,
          key: 'APP-2',
          title: 'Fix search',
          description: 'Search endpoint',
          estimateMinutes: 600,
          loggedMinutes: 120,
          remainingMinutes: 480,
          status: TaskStatus.IN_PROGRESS,
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          updatedAt: new Date('2026-10-02T00:00:00.000Z'),
        },
      ]),
      getCount: jest.fn().mockResolvedValue(1),
    };
    projectMemberRepository.exists.mockResolvedValue(true);
    taskRepository.createQueryBuilder.mockReturnValue(query);

    const result = await service.search(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'user-id' as Uuid,
      Object.assign(new SearchTasksReqDto(), {
        limit: 5,
        page: 2,
        q: 'search',
        status: TaskStatus.IN_PROGRESS,
        sprintId: 'sprint-id',
        parentTaskId: 'parent-id',
        sortBy: TaskSortBy.TITLE,
        order: Order.DESC,
      }),
    );

    expect(projectMemberRepository.exists).toHaveBeenCalledWith({
      where: {
        projectId: 'project-id',
        userId: 'user-id',
        project: { workspaceId: 'workspace-id' },
      },
    });
    expect(query.where).toHaveBeenCalledWith('task.projectId = :projectId', {
      projectId: 'project-id',
    });
    expect(query.andWhere).toHaveBeenNthCalledWith(1, 'task.status = :status', {
      status: TaskStatus.IN_PROGRESS,
    });
    expect(query.andWhere).toHaveBeenNthCalledWith(
      2,
      'task.sprintId = :sprintId',
      { sprintId: 'sprint-id' },
    );
    expect(query.andWhere).toHaveBeenNthCalledWith(
      3,
      'task.parentTaskId = :parentTaskId',
      { parentTaskId: 'parent-id' },
    );
    expect(query.andWhere).toHaveBeenNthCalledWith(
      4,
      '(task.title ILIKE :search OR task.key ILIKE :search OR task.description ILIKE :search)',
      { search: '%search%' },
    );
    expect(query.orderBy).toHaveBeenCalledWith('task.title', 'DESC');
    expect(query.addOrderBy).toHaveBeenCalledWith('task.id', 'ASC');
    expect(query.skip).toHaveBeenCalledWith(5);
    expect(query.take).toHaveBeenCalledWith(5);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].estimateHours).toBe(10);
    expect(result.pagination.totalRecords).toBe(1);
  });

  it('does not run a task search for users outside the project', async () => {
    projectMemberRepository.exists.mockResolvedValue(false);

    await expect(
      service.search(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'user-id' as Uuid,
        new SearchTasksReqDto(),
      ),
    ).rejects.toThrow('Project not found');
    expect(taskRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('recalculates remaining time after a work log is corrected', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    taskRepository.findOne.mockResolvedValue({
      id: 'task-id',
      projectId: 'project-id',
      estimateMinutes: 600,
      loggedMinutes: 480,
      remainingMinutes: 120,
    });
    workLogRepository.findOneBy.mockResolvedValue({
      id: 'work-log-id',
      taskId: 'task-id',
      userId: 'user-id',
      workDate: '2026-10-09',
      durationMinutes: 480,
    });
    workLogRepository.save.mockImplementation(async (log: object) => log);
    workLogRepository.sum.mockResolvedValue(540);
    taskRepository.save.mockImplementation(async (task: object) => task);

    const result = await service.updateWorkLog(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'task-id' as Uuid,
      'work-log-id' as Uuid,
      'user-id' as Uuid,
      { workDate: '2026-10-08', hours: 9 },
    );

    expect(result.workDate).toBe('2026-10-08');
    expect(result.hours).toBe(9);
    expect(workLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ workDate: '2026-10-08', durationMinutes: 540 }),
    );
    expect(taskRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ loggedMinutes: 540, remainingMinutes: 60 }),
    );
  });

  it('allows manually setting remaining time after the estimate is exhausted', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    taskRepository.findOne.mockResolvedValue({
      id: 'task-id',
      projectId: 'project-id',
      estimateMinutes: 600,
      loggedMinutes: 600,
      remainingMinutes: 0,
      status: TaskStatus.IN_PROGRESS,
    });
    taskRepository.save.mockImplementation(async (task: object) => task);

    const result = await service.updateRemaining(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'task-id' as Uuid,
      'user-id' as Uuid,
      { remainingHours: 2 },
    );

    expect(result.remainingHours).toBe(2);
  });

  it('does not allow changing another users work log', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    taskRepository.findOne.mockResolvedValue({
      id: 'task-id',
      projectId: 'project-id',
      estimateMinutes: 600,
      loggedMinutes: 60,
      remainingMinutes: 540,
    });
    workLogRepository.findOneBy.mockResolvedValue({
      id: 'work-log-id',
      taskId: 'task-id',
      userId: 'another-user',
      workDate: '2026-10-09',
      durationMinutes: 60,
    });

    await expect(
      service.updateWorkLog(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'task-id' as Uuid,
        'work-log-id' as Uuid,
        'user-id' as Uuid,
        { hours: 2 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(workLogRepository.save).not.toHaveBeenCalled();
  });

  it('supports cancelling and reopening tasks while rejecting invalid transitions', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    taskRepository.findOne.mockResolvedValue({
      id: 'task-id',
      projectId: 'project-id',
      status: TaskStatus.IN_PROGRESS,
    });
    taskRepository.save.mockImplementation(async (task: object) => task);

    const cancelled = await service.updateStatus(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'task-id' as Uuid,
      'user-id' as Uuid,
      { status: TaskStatus.CANCELLED },
    );
    expect(cancelled.status).toBe(TaskStatus.CANCELLED);

    taskRepository.findOne.mockResolvedValue({
      id: 'task-id',
      projectId: 'project-id',
      status: TaskStatus.CANCELLED,
    });
    const reopened = await service.updateStatus(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'task-id' as Uuid,
      'user-id' as Uuid,
      { status: TaskStatus.TODO },
    );
    expect(reopened.status).toBe(TaskStatus.TODO);

    taskRepository.findOne.mockResolvedValue({
      id: 'task-id',
      projectId: 'project-id',
      status: TaskStatus.TODO,
    });
    await expect(
      service.updateStatus(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'task-id' as Uuid,
        'user-id' as Uuid,
        { status: TaskStatus.DONE },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects task dependencies that would create a cycle', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    projectRepository.findOne.mockResolvedValue({ id: 'project-id' });
    taskRepository.findOneBy
      .mockResolvedValueOnce({ id: 'task-a', projectId: 'project-id' })
      .mockResolvedValueOnce({ id: 'task-b', projectId: 'project-id' });
    dependencyRepository.find.mockResolvedValue([
      {
        taskId: 'task-b',
        dependsOnTaskId: 'task-c',
      },
      {
        taskId: 'task-c',
        dependsOnTaskId: 'task-a',
      },
    ]);

    await expect(
      service.addDependency(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'task-a' as Uuid,
        'user-id' as Uuid,
        { dependsOnTaskId: 'task-b' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dependencyRepository.save).not.toHaveBeenCalled();
  });

  it('allows an acyclic dependency between tasks in the same project', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    projectRepository.findOne.mockResolvedValue({ id: 'project-id' });
    taskRepository.findOneBy
      .mockResolvedValueOnce({ id: 'task-a', projectId: 'project-id' })
      .mockResolvedValueOnce({
        id: 'task-b',
        projectId: 'project-id',
        key: 'ABC-2',
        title: 'Prerequisite',
      });
    dependencyRepository.find.mockResolvedValue([]);
    dependencyRepository.exists.mockResolvedValue(false);
    dependencyRepository.create.mockImplementation((data: object) => data);
    dependencyRepository.save.mockImplementation(
      async (dependency: object) => ({
        ...dependency,
        id: 'dependency-id',
      }),
    );

    const result = await service.addDependency(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'task-a' as Uuid,
      'user-id' as Uuid,
      { dependsOnTaskId: 'task-b' },
    );

    expect(result.dependsOnTaskKey).toBe('ABC-2');
    expect(dependencyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-a',
        dependsOnTaskId: 'task-b',
      }),
    );
  });
});
