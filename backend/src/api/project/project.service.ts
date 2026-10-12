import { Uuid } from '@/common/types/common.type';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { QueryFailedError, Repository } from 'typeorm';
import {
  WorkspaceMemberEntity,
  WorkspaceMemberStatus,
} from '../workspace/entities/workspace-member.entity';
import { AddProjectMemberReqDto } from './dto/add-project-member.req.dto';
import { CreateProjectReqDto } from './dto/create-project.req.dto';
import { ProjectMemberResDto } from './dto/project-member.res.dto';
import { ProjectResDto } from './dto/project.res.dto';
import { TransitionProjectReqDto } from './dto/transition-project.req.dto';
import { UpdateProjectReqDto } from './dto/update-project.req.dto';
import { ProjectMemberEntity } from './entities/project-member.entity';
import { ProjectWorkflowEntity } from './entities/project-workflow.entity';
import { ProjectEntity } from './entities/project.entity';
import { WorkflowStatusEntity } from './entities/workflow-status.entity';
import { WorkflowTransitionEntity } from './entities/workflow-transition.entity';

const DEFAULT_STATUSES = [
  {
    key: 'BACKLOG',
    name: 'Backlog',
    position: 0,
    isInitial: true,
    isFinal: false,
  },
  {
    key: 'IN_PROGRESS',
    name: 'In Progress',
    position: 1,
    isInitial: false,
    isFinal: false,
  },
  { key: 'DONE', name: 'Done', position: 2, isInitial: false, isFinal: true },
] as const;

const DEFAULT_TRANSITIONS = [
  ['BACKLOG', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'BACKLOG'],
  ['IN_PROGRESS', 'DONE'],
  ['DONE', 'IN_PROGRESS'],
] as const;

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMemberRepository: Repository<ProjectMemberEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    @InjectRepository(WorkflowStatusEntity)
    private readonly statusRepository: Repository<WorkflowStatusEntity>,
    @InjectRepository(WorkflowTransitionEntity)
    private readonly transitionRepository: Repository<WorkflowTransitionEntity>,
  ) {}

  async create(
    workspaceId: Uuid,
    actorId: Uuid,
    reqDto: CreateProjectReqDto,
  ): Promise<ProjectResDto> {
    const key = reqDto.key.trim().toUpperCase();
    try {
      return await this.projectRepository.manager.transaction(
        async (manager) => {
          const projectRepository = manager.getRepository(ProjectEntity);
          const workflowRepository = manager.getRepository(
            ProjectWorkflowEntity,
          );
          const statusRepository = manager.getRepository(WorkflowStatusEntity);
          const transitionRepository = manager.getRepository(
            WorkflowTransitionEntity,
          );
          const memberRepository = manager.getRepository(ProjectMemberEntity);

          const project = await projectRepository.save(
            projectRepository.create({
              workspaceId,
              name: reqDto.name.trim(),
              key,
              description: reqDto.description?.trim() || null,
              currentStatusId: null,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );
          const workflow = await workflowRepository.save(
            workflowRepository.create({
              projectId: project.id,
              name: 'Default workflow',
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );
          const statuses = await statusRepository.save(
            DEFAULT_STATUSES.map((status) =>
              statusRepository.create({
                ...status,
                workflowId: workflow.id,
                createdBy: actorId,
                updatedBy: actorId,
              }),
            ),
          );
          const statusByKey = new Map(
            statuses.map((status) => [status.key, status]),
          );
          await transitionRepository.save(
            DEFAULT_TRANSITIONS.map(([fromKey, toKey]) =>
              transitionRepository.create({
                workflowId: workflow.id,
                fromStatusId: statusByKey.get(fromKey)!.id,
                toStatusId: statusByKey.get(toKey)!.id,
                createdBy: actorId,
                updatedBy: actorId,
              }),
            ),
          );
          project.currentStatusId = statusByKey.get('BACKLOG')!.id;
          project.updatedBy = actorId;
          const initializedProject = await projectRepository.save(project);
          await memberRepository.save(
            memberRepository.create({
              projectId: project.id,
              userId: actorId,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );

          workflow.statuses = statuses;
          initializedProject.workflow = workflow;
          initializedProject.currentStatus = statusByKey.get('BACKLOG')!;
          return this.toDto(initializedProject);
        },
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError?.code === '23505' &&
        error.driverError?.constraint === 'UQ_projects_workspace_key'
      ) {
        throw new ConflictException(
          'A project with this key already exists in the workspace.',
        );
      }
      throw error;
    }
  }

  async findAll(workspaceId: Uuid, userId: Uuid): Promise<ProjectResDto[]> {
    const memberships = await this.projectMemberRepository.find({
      where: { userId, project: { workspaceId } },
      relations: {
        project: { workflow: { statuses: true }, currentStatus: true },
      },
      order: { createdAt: 'ASC' },
    });

    return memberships.map(({ project }) => this.toDto(project));
  }

  async findOne(
    workspaceId: Uuid,
    projectId: Uuid,
    userId: Uuid,
  ): Promise<ProjectResDto> {
    return this.toDto(await this.findProject(workspaceId, projectId, userId));
  }

  async update(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
    reqDto: UpdateProjectReqDto,
  ): Promise<ProjectResDto> {
    const project = await this.findProject(workspaceId, projectId, actorId);
    if (reqDto.name !== undefined) {
      project.name = reqDto.name.trim();
    }
    if (reqDto.description !== undefined) {
      project.description = reqDto.description.trim() || null;
    }
    project.updatedBy = actorId;
    return this.toDto(await this.projectRepository.save(project));
  }

  async delete(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
  ): Promise<void> {
    const project = await this.findProject(workspaceId, projectId, actorId);
    await this.projectRepository.remove(project);
  }

  async findMembers(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
  ): Promise<ProjectMemberResDto[]> {
    await this.findProject(workspaceId, projectId, actorId);
    const members = await this.projectMemberRepository.find({
      where: { projectId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return members.map((member) =>
      plainToInstance(ProjectMemberResDto, {
        ...member,
        email: member.user.email,
      }),
    );
  }

  async addMember(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
    reqDto: AddProjectMemberReqDto,
  ): Promise<ProjectMemberResDto> {
    await this.findProject(workspaceId, projectId, actorId);
    const userId = reqDto.userId as Uuid;
    const workspaceMember = await this.workspaceMemberRepository.findOne({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      relations: { user: true },
    });
    if (!workspaceMember) {
      throw new NotFoundException('Active workspace member not found');
    }

    try {
      const member = await this.projectMemberRepository.save(
        this.projectMemberRepository.create({
          projectId,
          userId,
          createdBy: actorId,
          updatedBy: actorId,
        }),
      );
      return plainToInstance(ProjectMemberResDto, {
        ...member,
        email: workspaceMember.user?.email ?? '',
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError?.code === '23505' &&
        error.driverError?.constraint === 'UQ_project_members_project_user'
      ) {
        throw new ConflictException('User is already a project member.');
      }
      throw error;
    }
  }

  async removeMember(
    workspaceId: Uuid,
    projectId: Uuid,
    memberUserId: Uuid,
    actorId: Uuid,
  ): Promise<void> {
    await this.findProject(workspaceId, projectId, actorId);
    if (memberUserId === actorId) {
      throw new ForbiddenException(
        'You cannot remove yourself from a project.',
      );
    }
    const member = await this.projectMemberRepository.findOneBy({
      projectId,
      userId: memberUserId,
    });
    if (!member) {
      throw new NotFoundException('Project member not found');
    }
    await this.projectMemberRepository.remove(member);
  }

  async transition(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
    reqDto: TransitionProjectReqDto,
  ): Promise<ProjectResDto> {
    const project = await this.findProject(workspaceId, projectId, actorId);
    const targetStatusId = reqDto.statusId as Uuid;
    const workflow = project.workflow;
    if (!workflow) {
      throw new InternalServerErrorException(
        'Project workflow is not initialized.',
      );
    }
    const targetStatus = workflow.statuses?.find(
      (status) => status.id === targetStatusId,
    );
    if (!targetStatus || !project.currentStatusId) {
      throw new NotFoundException('Workflow status not found');
    }
    const transitionExists = await this.transitionRepository.exists({
      where: {
        workflowId: workflow.id,
        fromStatusId: project.currentStatusId,
        toStatusId: targetStatusId,
      },
    });
    if (!transitionExists) {
      throw new ConflictException('This workflow transition is not allowed.');
    }

    project.currentStatusId = targetStatusId;
    project.currentStatus = targetStatus;
    project.updatedBy = actorId;
    return this.toDto(await this.projectRepository.save(project));
  }

  private async findProject(
    workspaceId: Uuid,
    projectId: Uuid,
    userId: Uuid,
  ): Promise<ProjectEntity> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, workspaceId, members: { userId } },
      relations: {
        workflow: { statuses: true },
        currentStatus: true,
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private toDto(project: ProjectEntity): ProjectResDto {
    const statuses = [...(project.workflow?.statuses ?? [])].sort(
      (left, right) => left.position - right.position,
    );
    return plainToInstance(ProjectResDto, {
      ...project,
      currentStatusName: project.currentStatus?.name ?? null,
      statuses,
    });
  }
}
