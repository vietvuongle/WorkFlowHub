import { Uuid } from '@/common/types/common.type';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import { ProjectEntity } from '../project/entities/project.entity';
import { TaskEntity } from '../task/entities/task.entity';
import { SprintEntity, SprintStatus } from './entities/sprint.entity';
import { SprintService } from './sprint.service';

function createRepositoryMock() {
  return {
    create: jest.fn((data: object) => data),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    exists: jest.fn(),
  };
}

describe('SprintService', () => {
  let service: SprintService;
  let projectMemberRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let sprintRepository: ReturnType<typeof createRepositoryMock>;
  let taskRepository: ReturnType<typeof createRepositoryMock>;
  let dataSourceValue: { transaction: jest.Mock };

  beforeEach(async () => {
    projectMemberRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    sprintRepository = createRepositoryMock();
    taskRepository = createRepositoryMock();
    const repositories = new Map<
      unknown,
      ReturnType<typeof createRepositoryMock>
    >([
      [ProjectEntity, projectRepository],
      [SprintEntity, sprintRepository],
    ]);
    const transactionManager = {
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
        SprintService,
        { provide: DataSource, useValue: dataSourceValue },
        {
          provide: getRepositoryToken(ProjectMemberEntity),
          useValue: projectMemberRepository,
        },
        {
          provide: getRepositoryToken(ProjectEntity),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(SprintEntity),
          useValue: sprintRepository,
        },
        {
          provide: getRepositoryToken(TaskEntity),
          useValue: taskRepository,
        },
      ],
    }).compile();
    service = module.get(SprintService);
  });

  it('rejects invalid sprint date ranges', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);

    await expect(
      service.create(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'user-id' as Uuid,
        {
          name: 'Sprint 1',
          startDate: '2026-10-20',
          endDate: '2026-10-10',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sprintRepository.save).not.toHaveBeenCalled();
  });

  it('starts only a planned sprint and serializes start operations by project', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    projectRepository.findOne.mockResolvedValue({ id: 'project-id' });
    sprintRepository.findOne.mockResolvedValue({
      id: 'sprint-id',
      projectId: 'project-id',
      status: SprintStatus.PLANNED,
    });
    sprintRepository.save.mockImplementation(async (sprint: object) => sprint);

    const result = await service.start(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'sprint-id' as Uuid,
      'user-id' as Uuid,
    );

    expect(result.status).toBe(SprintStatus.ACTIVE);
    expect(projectRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-id', workspaceId: 'workspace-id' },
        lock: { mode: 'pessimistic_write' },
      }),
    );
  });

  it('does not allow completing a sprint that is not active', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    sprintRepository.findOneBy.mockResolvedValue({
      id: 'sprint-id',
      projectId: 'project-id',
      status: SprintStatus.PLANNED,
    });

    await expect(
      service.complete(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'sprint-id' as Uuid,
        'user-id' as Uuid,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(sprintRepository.save).not.toHaveBeenCalled();
  });

  it('assigns a task only when it belongs to the sprint project', async () => {
    projectMemberRepository.exists.mockResolvedValue(true);
    sprintRepository.findOneBy.mockResolvedValue({
      id: 'sprint-id',
      projectId: 'project-id',
      status: SprintStatus.PLANNED,
    });
    taskRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.assignTask(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'sprint-id' as Uuid,
        'foreign-task-id' as Uuid,
        'user-id' as Uuid,
      ),
    ).rejects.toThrow('Task not found in this project');
    expect(taskRepository.save).not.toHaveBeenCalled();
  });
});
