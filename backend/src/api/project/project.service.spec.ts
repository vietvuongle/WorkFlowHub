import { Uuid } from '@/common/types/common.type';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspaceMemberEntity } from '../workspace/entities/workspace-member.entity';
import { AddProjectMemberReqDto } from './dto/add-project-member.req.dto';
import { CreateProjectReqDto } from './dto/create-project.req.dto';
import { TransitionProjectReqDto } from './dto/transition-project.req.dto';
import { ProjectMemberEntity } from './entities/project-member.entity';
import { ProjectWorkflowEntity } from './entities/project-workflow.entity';
import { ProjectEntity } from './entities/project.entity';
import { WorkflowStatusEntity } from './entities/workflow-status.entity';
import { WorkflowTransitionEntity } from './entities/workflow-transition.entity';
import { ProjectService } from './project.service';

function createRepositoryMock() {
  return {
    create: jest.fn((data: object) => data),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    remove: jest.fn(),
    exists: jest.fn(),
    manager: { transaction: jest.fn() },
  };
}

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let projectMemberRepository: ReturnType<typeof createRepositoryMock>;
  let workspaceMemberRepository: ReturnType<typeof createRepositoryMock>;
  let workflowRepository: ReturnType<typeof createRepositoryMock>;
  let statusRepository: ReturnType<typeof createRepositoryMock>;
  let transitionRepository: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    projectRepository = createRepositoryMock();
    projectMemberRepository = createRepositoryMock();
    workspaceMemberRepository = createRepositoryMock();
    workflowRepository = createRepositoryMock();
    statusRepository = createRepositoryMock();
    transitionRepository = createRepositoryMock();

    const transactionRepositories = new Map<
      unknown,
      ReturnType<typeof createRepositoryMock>
    >([
      [ProjectEntity, projectRepository],
      [ProjectWorkflowEntity, workflowRepository],
      [WorkflowStatusEntity, statusRepository],
      [WorkflowTransitionEntity, transitionRepository],
      [ProjectMemberEntity, projectMemberRepository],
    ]);
    projectRepository.manager.transaction.mockImplementation(
      (
        callback: (manager: {
          getRepository: (entity: unknown) => unknown;
        }) => unknown,
      ) =>
        callback({
          getRepository: (entity: unknown) =>
            transactionRepositories.get(entity),
        }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: getRepositoryToken(ProjectEntity),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(ProjectMemberEntity),
          useValue: projectMemberRepository,
        },
        {
          provide: getRepositoryToken(WorkspaceMemberEntity),
          useValue: workspaceMemberRepository,
        },
        {
          provide: getRepositoryToken(WorkflowStatusEntity),
          useValue: statusRepository,
        },
        {
          provide: getRepositoryToken(WorkflowTransitionEntity),
          useValue: transitionRepository,
        },
      ],
    }).compile();

    service = module.get(ProjectService);
  });

  it('creates the project, initial status, default transitions, and creator membership atomically', async () => {
    workflowRepository.save.mockImplementation(async (workflow: object) => ({
      ...workflow,
      id: 'workflow-id',
    }));
    projectRepository.save
      .mockImplementationOnce(async (project: object) => ({
        ...project,
        id: 'project-id',
      }))
      .mockImplementationOnce(async (project: object) => project);
    statusRepository.save.mockImplementation(async (statuses: object[]) =>
      statuses.map((status, index) => ({
        ...status,
        id: `status-${index}`,
      })),
    );
    const dto = {
      name: '  WorkflowHub  ',
      key: ' wh ',
      description: '  Internal tools  ',
    } satisfies CreateProjectReqDto;

    const result = await service.create(
      'workspace-id' as Uuid,
      'creator-id' as Uuid,
      dto,
    );

    expect(result.key).toBe('WH');
    expect(result.currentStatusId).toBe('status-0');
    expect(result.statuses.map(({ key }) => key)).toEqual([
      'BACKLOG',
      'IN_PROGRESS',
      'DONE',
    ]);
    expect(transitionRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          fromStatusId: 'status-0',
          toStatusId: 'status-1',
        }),
      ]),
    );
    expect(projectMemberRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-id',
        userId: 'creator-id',
      }),
    );
  });

  it('scopes project lookup to workspace and project membership', async () => {
    projectRepository.findOne.mockResolvedValue(null);

    await expect(
      service.findOne(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'user-id' as Uuid,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(projectRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'project-id',
          workspaceId: 'workspace-id',
          members: { userId: 'user-id' },
        },
      }),
    );
  });

  it('rejects a transition that is not present in the workflow', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
      currentStatusId: 'backlog-id',
      workflow: {
        id: 'workflow-id',
        statuses: [{ id: 'progress-id' }],
      },
    });
    transitionRepository.exists.mockResolvedValue(false);

    await expect(
      service.transition(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'user-id' as Uuid,
        { statusId: 'progress-id' } satisfies TransitionProjectReqDto,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(projectRepository.save).not.toHaveBeenCalled();
  });

  it('updates the current status when a transition is allowed', async () => {
    const project = {
      id: 'project-id',
      workspaceId: 'workspace-id',
      currentStatusId: 'backlog-id',
      workflow: {
        id: 'workflow-id',
        statuses: [
          {
            id: 'progress-id',
            key: 'IN_PROGRESS',
            name: 'In Progress',
            position: 1,
          },
        ],
      },
    };
    projectRepository.findOne.mockResolvedValue(project);
    transitionRepository.exists.mockResolvedValue(true);
    projectRepository.save.mockImplementation(async (value: object) => value);

    const result = await service.transition(
      'workspace-id' as Uuid,
      'project-id' as Uuid,
      'user-id' as Uuid,
      { statusId: 'progress-id' } satisfies TransitionProjectReqDto,
    );

    expect(result.currentStatusId).toBe('progress-id');
    expect(transitionRepository.exists).toHaveBeenCalledWith({
      where: {
        workflowId: 'workflow-id',
        fromStatusId: 'backlog-id',
        toStatusId: 'progress-id',
      },
    });
  });

  it('only adds active members of the same workspace to a project', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: 'project-id',
      workflow: { statuses: [] },
    });
    workspaceMemberRepository.findOne.mockResolvedValue(null);

    await expect(
      service.addMember(
        'workspace-id' as Uuid,
        'project-id' as Uuid,
        'actor-id' as Uuid,
        { userId: 'outsider-id' } satisfies AddProjectMemberReqDto,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(projectMemberRepository.save).not.toHaveBeenCalled();
  });
});
