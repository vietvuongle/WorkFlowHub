import { Uuid } from '@/common/types/common.type';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import { ProjectEntity } from '../project/entities/project.entity';
import { TaskEntity } from '../task/entities/task.entity';
import { CreateSprintReqDto } from './dto/create-sprint.req.dto';
import { SprintTaskResDto } from './dto/sprint-task.res.dto';
import { SprintResDto } from './dto/sprint.res.dto';
import { SprintEntity, SprintStatus } from './entities/sprint.entity';

@Injectable()
export class SprintService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMemberRepository: Repository<ProjectMemberEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(SprintEntity)
    private readonly sprintRepository: Repository<SprintEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
  ) {}

  async create(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
    dto: CreateSprintReqDto,
  ): Promise<SprintResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    this.assertValidDateRange(dto.startDate, dto.endDate);
    const sprint = await this.sprintRepository.save(
      this.sprintRepository.create({
        projectId,
        name: dto.name.trim(),
        goal: dto.goal?.trim() || null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: SprintStatus.PLANNED,
        completedAt: null,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );
    return plainToInstance(SprintResDto, sprint);
  }

  async findAll(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
  ): Promise<SprintResDto[]> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const sprints = await this.sprintRepository.find({
      where: { projectId },
      order: { startDate: 'DESC', createdAt: 'DESC' },
    });
    return plainToInstance(SprintResDto, sprints);
  }

  async findOne(
    workspaceId: Uuid,
    projectId: Uuid,
    sprintId: Uuid,
    actorId: Uuid,
  ): Promise<SprintResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    return plainToInstance(
      SprintResDto,
      await this.findSprint(projectId, sprintId),
    );
  }

  async start(
    workspaceId: Uuid,
    projectId: Uuid,
    sprintId: Uuid,
    actorId: Uuid,
  ): Promise<SprintResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    try {
      const sprint = await this.dataSource.transaction(async (manager) => {
        const projectRepository = manager.getRepository(ProjectEntity);
        const sprintRepository = manager.getRepository(SprintEntity);
        const project = await projectRepository.findOne({
          where: { id: projectId, workspaceId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!project) {
          throw new NotFoundException('Project not found');
        }
        const sprint = await sprintRepository.findOne({
          where: { id: sprintId, projectId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!sprint) {
          throw new NotFoundException('Sprint not found');
        }
        if (sprint.status !== SprintStatus.PLANNED) {
          throw new ConflictException('Only a planned sprint can be started.');
        }
        sprint.status = SprintStatus.ACTIVE;
        sprint.updatedBy = actorId;
        return sprintRepository.save(sprint);
      });
      return plainToInstance(SprintResDto, sprint);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError?.code === '23505' &&
        error.driverError?.constraint === 'UQ_sprints_one_active_per_project'
      ) {
        throw new ConflictException(
          'This project already has an active sprint.',
        );
      }
      throw error;
    }
  }

  async complete(
    workspaceId: Uuid,
    projectId: Uuid,
    sprintId: Uuid,
    actorId: Uuid,
  ): Promise<SprintResDto> {
    return this.changeStatus(
      workspaceId,
      projectId,
      sprintId,
      actorId,
      SprintStatus.ACTIVE,
      SprintStatus.COMPLETED,
    );
  }

  async cancel(
    workspaceId: Uuid,
    projectId: Uuid,
    sprintId: Uuid,
    actorId: Uuid,
  ): Promise<SprintResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const sprint = await this.findSprint(projectId, sprintId);
    if (
      sprint.status !== SprintStatus.PLANNED &&
      sprint.status !== SprintStatus.ACTIVE
    ) {
      throw new ConflictException(
        'Only a planned or active sprint can be cancelled.',
      );
    }
    sprint.status = SprintStatus.CANCELLED;
    sprint.updatedBy = actorId;
    return plainToInstance(
      SprintResDto,
      await this.sprintRepository.save(sprint),
    );
  }

  async assignTask(
    workspaceId: Uuid,
    projectId: Uuid,
    sprintId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<void> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const sprint = await this.findSprint(projectId, sprintId);
    if (
      sprint.status !== SprintStatus.PLANNED &&
      sprint.status !== SprintStatus.ACTIVE
    ) {
      throw new ConflictException(
        'Tasks can only be assigned to planned or active sprints.',
      );
    }
    const task = await this.taskRepository.findOneBy({ id: taskId, projectId });
    if (!task) {
      throw new NotFoundException('Task not found in this project');
    }
    task.sprintId = sprint.id;
    task.updatedBy = actorId;
    await this.taskRepository.save(task);
  }

  async removeTask(
    workspaceId: Uuid,
    projectId: Uuid,
    sprintId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<void> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    await this.findSprint(projectId, sprintId);
    const task = await this.taskRepository.findOneBy({
      id: taskId,
      projectId,
      sprintId,
    });
    if (!task) {
      throw new NotFoundException('Task is not assigned to this sprint');
    }
    task.sprintId = null;
    task.updatedBy = actorId;
    await this.taskRepository.save(task);
  }

  async findTasks(
    workspaceId: Uuid,
    projectId: Uuid,
    sprintId: Uuid,
    actorId: Uuid,
  ): Promise<SprintTaskResDto[]> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    await this.findSprint(projectId, sprintId);
    const tasks = await this.taskRepository.find({
      where: { projectId, sprintId },
      order: { number: 'ASC' },
    });
    return plainToInstance(
      SprintTaskResDto,
      tasks.map((task) => ({
        ...task,
        estimateHours: task.estimateMinutes / 60,
        loggedHours: task.loggedMinutes / 60,
        remainingHours: task.remainingMinutes / 60,
      })),
    );
  }

  private async changeStatus(
    workspaceId: Uuid,
    projectId: Uuid,
    sprintId: Uuid,
    actorId: Uuid,
    requiredStatus: SprintStatus,
    status: SprintStatus,
  ): Promise<SprintResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const sprint = await this.findSprint(projectId, sprintId);
    if (sprint.status !== requiredStatus) {
      throw new ConflictException(
        `Only a ${requiredStatus.toLowerCase()} sprint can be ${status.toLowerCase()}.`,
      );
    }
    sprint.status = status;
    sprint.completedAt = new Date();
    sprint.updatedBy = actorId;
    return plainToInstance(
      SprintResDto,
      await this.sprintRepository.save(sprint),
    );
  }

  private async assertProjectMember(
    workspaceId: Uuid,
    projectId: Uuid,
    userId: Uuid,
  ): Promise<void> {
    const isMember = await this.projectMemberRepository.exists({
      where: { projectId, userId, project: { workspaceId } },
    });
    if (!isMember) {
      throw new NotFoundException('Project not found');
    }
  }

  private async findSprint(
    projectId: Uuid,
    sprintId: Uuid,
  ): Promise<SprintEntity> {
    const sprint = await this.sprintRepository.findOneBy({
      id: sprintId,
      projectId,
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }
    return sprint;
  }

  private assertValidDateRange(startDate: string, endDate: string): void {
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      throw new BadRequestException(
        'Sprint dates must be valid YYYY-MM-DD dates.',
      );
    }
    if (endDate < startDate) {
      throw new BadRequestException(
        'Sprint end date cannot be before start date.',
      );
    }
  }

  private isValidDate(value: string): boolean {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }
}
