import { OffsetPaginatedDto } from '@/common/dto/offset-pagination/paginated.dto';
import { Uuid } from '@/common/types/common.type';
import { RedisLockService } from '@/redis/redis-lock.service';
import { paginate } from '@/utils/offset-pagination';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { DataSource, Repository } from 'typeorm';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import { ProjectEntity } from '../project/entities/project.entity';
import { CreateTaskDependencyReqDto } from './dto/create-task-dependency.req.dto';
import { CreateTaskReqDto } from './dto/create-task.req.dto';
import { CreateWorkLogReqDto } from './dto/create-work-log.req.dto';
import { SearchTasksReqDto, TaskSortBy } from './dto/search-tasks.req.dto';
import { TaskDependencyResDto } from './dto/task-dependency.res.dto';
import { TaskResDto } from './dto/task.res.dto';
import { UpdateTaskRemainingReqDto } from './dto/update-task-remaining.req.dto';
import { UpdateTaskStatusReqDto } from './dto/update-task-status.req.dto';
import { UpdateTaskReqDto } from './dto/update-task.req.dto';
import { UpdateWorkLogReqDto } from './dto/update-work-log.req.dto';
import { WorkLogResDto } from './dto/work-log.res.dto';
import { TaskDependencyEntity } from './entities/task-dependency.entity';
import { TaskEntity, TaskStatus } from './entities/task.entity';
import { WorkLogEntity } from './entities/work-log.entity';
import { TaskAttachmentService } from './task-attachment.service';

const ALLOWED_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [
    TaskStatus.TODO,
    TaskStatus.IN_REVIEW,
    TaskStatus.DONE,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.IN_REVIEW]: [
    TaskStatus.IN_PROGRESS,
    TaskStatus.DONE,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.DONE]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
  [TaskStatus.CANCELLED]: [TaskStatus.TODO],
};

const TASK_SORT_COLUMNS: Record<TaskSortBy, string> = {
  [TaskSortBy.NUMBER]: 'task.number',
  [TaskSortBy.TITLE]: 'task.title',
  [TaskSortBy.STATUS]: 'task.status',
  [TaskSortBy.CREATED_AT]: 'task.createdAt',
  [TaskSortBy.UPDATED_AT]: 'task.updatedAt',
  [TaskSortBy.ESTIMATE]: 'task.estimateMinutes',
  [TaskSortBy.LOGGED]: 'task.loggedMinutes',
  [TaskSortBy.REMAINING]: 'task.remainingMinutes',
};

@Injectable()
export class TaskService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMemberRepository: Repository<ProjectMemberEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(WorkLogEntity)
    private readonly workLogRepository: Repository<WorkLogEntity>,
    @InjectRepository(TaskDependencyEntity)
    private readonly dependencyRepository: Repository<TaskDependencyEntity>,
    private readonly redisLockService: RedisLockService,
    private readonly taskAttachmentService: TaskAttachmentService,
  ) {}

  async create(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
    dto: CreateTaskReqDto,
  ): Promise<TaskResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const estimateMinutes = this.toMinutes(dto.estimateHours);

    const task = await this.redisLockService.withLock(
      `project:${projectId}:task-sequence`,
      () =>
        this.dataSource.transaction(async (manager) => {
          const projectRepository = manager.getRepository(ProjectEntity);
          const taskRepository = manager.getRepository(TaskEntity);
          const project = await projectRepository.findOne({
            where: { id: projectId, workspaceId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!project) {
            throw new NotFoundException('Project not found');
          }
          const parentTaskId = dto.parentTaskId as Uuid | undefined;
          if (parentTaskId) {
            const parentTask = await taskRepository.findOneBy({
              id: parentTaskId,
              projectId,
            });
            if (!parentTask) {
              throw new NotFoundException(
                'Parent task not found in this project',
              );
            }
          }

          const number = project.nextTaskNumber;
          project.nextTaskNumber += 1;
          project.updatedBy = actorId;
          await projectRepository.save(project);

          return taskRepository.save(
            taskRepository.create({
              projectId,
              parentTaskId: parentTaskId ?? null,
              sprintId: null,
              number,
              key: `${project.key}-${number}`,
              title: dto.title.trim(),
              description: dto.description?.trim() || null,
              estimateMinutes,
              loggedMinutes: 0,
              remainingMinutes: estimateMinutes,
              status: TaskStatus.TODO,
              createdBy: actorId,
              updatedBy: actorId,
            }),
          );
        }),
    );

    return this.toTaskDto(task);
  }

  async findAll(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
  ): Promise<TaskResDto[]> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const tasks = await this.taskRepository.find({
      where: { projectId },
      order: { number: 'ASC' },
    });
    return plainToInstance(
      TaskResDto,
      tasks.map((task) => this.toTaskData(task)),
    );
  }

  async search(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
    reqDto: SearchTasksReqDto,
  ): Promise<OffsetPaginatedDto<TaskResDto>> {
    await this.assertProjectMember(workspaceId, projectId, actorId);

    const query = this.taskRepository
      .createQueryBuilder('task')
      .where('task.projectId = :projectId', { projectId });

    if (reqDto.status) {
      query.andWhere('task.status = :status', { status: reqDto.status });
    }
    if (reqDto.sprintId) {
      query.andWhere('task.sprintId = :sprintId', {
        sprintId: reqDto.sprintId,
      });
    }
    if (reqDto.parentTaskId) {
      query.andWhere('task.parentTaskId = :parentTaskId', {
        parentTaskId: reqDto.parentTaskId,
      });
    }
    if (reqDto.q) {
      query.andWhere(
        '(task.title ILIKE :search OR task.key ILIKE :search OR task.description ILIKE :search)',
        { search: `%${reqDto.q.trim()}%` },
      );
    }

    query
      .orderBy(
        TASK_SORT_COLUMNS[reqDto.sortBy ?? TaskSortBy.NUMBER],
        reqDto.order,
      )
      .addOrderBy('task.id', 'ASC');

    const [tasks, pagination] = await paginate(query, reqDto);
    const data = plainToInstance(
      TaskResDto,
      tasks.map((task) => this.toTaskData(task)),
    );
    return new OffsetPaginatedDto(data, pagination);
  }

  async findOne(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<TaskResDto> {
    return this.toTaskDto(
      await this.findTask(workspaceId, projectId, taskId, actorId),
    );
  }

  async findSubtasks(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<TaskResDto[]> {
    await this.findTask(workspaceId, projectId, taskId, actorId);
    const subtasks = await this.taskRepository.find({
      where: { projectId, parentTaskId: taskId },
      order: { number: 'ASC' },
    });
    return plainToInstance(
      TaskResDto,
      subtasks.map((task) => this.toTaskData(task)),
    );
  }

  async findDependencies(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<TaskDependencyResDto[]> {
    await this.findTask(workspaceId, projectId, taskId, actorId);
    const dependencies = await this.dependencyRepository.find({
      where: { projectId, taskId },
      relations: { dependsOnTask: true },
      order: { createdAt: 'ASC' },
    });
    return plainToInstance(
      TaskDependencyResDto,
      dependencies.map((dependency) => ({
        ...dependency,
        dependsOnTaskKey: dependency.dependsOnTask.key,
        dependsOnTaskTitle: dependency.dependsOnTask.title,
      })),
    );
  }

  async addDependency(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
    dto: CreateTaskDependencyReqDto,
  ): Promise<TaskDependencyResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const dependsOnTaskId = dto.dependsOnTaskId as Uuid;
    if (taskId === dependsOnTaskId) {
      throw new ConflictException('A task cannot depend on itself.');
    }

    const { dependency, dependsOnTask } = await this.dataSource.transaction(
      async (manager) => {
        const projectRepository = manager.getRepository(ProjectEntity);
        const taskRepository = manager.getRepository(TaskEntity);
        const dependencyRepository =
          manager.getRepository(TaskDependencyEntity);
        const project = await projectRepository.findOne({
          where: { id: projectId, workspaceId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!project) {
          throw new NotFoundException('Project not found');
        }
        const [task, dependsOnTask] = await Promise.all([
          taskRepository.findOneBy({ id: taskId, projectId }),
          taskRepository.findOneBy({ id: dependsOnTaskId, projectId }),
        ]);
        if (!task || !dependsOnTask) {
          throw new NotFoundException('Both tasks must belong to this project');
        }
        const dependencies = await dependencyRepository.find({
          where: { projectId },
        });
        const graph = new Map<Uuid, Uuid[]>();
        for (const item of dependencies) {
          graph.set(item.taskId, [
            ...(graph.get(item.taskId) ?? []),
            item.dependsOnTaskId,
          ]);
        }
        const pending = [dependsOnTaskId];
        const visited = new Set<Uuid>();
        while (pending.length > 0) {
          const current = pending.pop()!;
          if (current === taskId) {
            throw new ConflictException(
              'This dependency would create a cycle.',
            );
          }
          if (visited.has(current)) {
            continue;
          }
          visited.add(current);
          pending.push(...(graph.get(current) ?? []));
        }

        if (
          await dependencyRepository.exists({
            where: { taskId, dependsOnTaskId },
          })
        ) {
          throw new ConflictException('This task dependency already exists.');
        }

        const savedDependency = await dependencyRepository.save(
          dependencyRepository.create({
            projectId,
            taskId,
            dependsOnTaskId,
            createdBy: actorId,
            updatedBy: actorId,
          }),
        );
        return { dependency: savedDependency, dependsOnTask };
      },
    );
    return plainToInstance(TaskDependencyResDto, {
      ...dependency,
      dependsOnTaskKey: dependsOnTask.key,
      dependsOnTaskTitle: dependsOnTask.title,
    });
  }

  async removeDependency(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    dependencyId: Uuid,
    actorId: Uuid,
  ): Promise<void> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const dependency = await this.dependencyRepository.findOneBy({
      id: dependencyId,
      projectId,
      taskId,
    });
    if (!dependency) {
      throw new NotFoundException('Task dependency not found');
    }
    await this.dependencyRepository.remove(dependency);
  }

  async update(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
    dto: UpdateTaskReqDto,
  ): Promise<TaskResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const task = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TaskEntity);
      const task = await repository.findOne({
        where: { id: taskId, projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      if (dto.title !== undefined) {
        task.title = dto.title.trim();
      }
      if (dto.description !== undefined) {
        task.description = dto.description.trim() || null;
      }
      if (dto.estimateHours !== undefined) {
        task.estimateMinutes = this.toMinutes(dto.estimateHours);
        task.remainingMinutes = Math.max(
          task.estimateMinutes - task.loggedMinutes,
          0,
        );
      }
      task.updatedBy = actorId;
      return repository.save(task);
    });
    return this.toTaskDto(task);
  }

  async delete(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<void> {
    const task = await this.findTask(workspaceId, projectId, taskId, actorId);
    await this.taskAttachmentService.deleteAllForTask(taskId);
    await this.taskRepository.remove(task);
  }

  async updateRemaining(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
    dto: UpdateTaskRemainingReqDto,
  ): Promise<TaskResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const task = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TaskEntity);
      const task = await repository.findOne({
        where: { id: taskId, projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      task.remainingMinutes = this.toMinutes(dto.remainingHours, true);
      task.updatedBy = actorId;
      return repository.save(task);
    });
    return this.toTaskDto(task);
  }

  async updateStatus(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
    dto: UpdateTaskStatusReqDto,
  ): Promise<TaskResDto> {
    const task = await this.findTask(workspaceId, projectId, taskId, actorId);
    if (!ALLOWED_TASK_TRANSITIONS[task.status].includes(dto.status)) {
      throw new ConflictException(
        `Cannot transition task from ${task.status} to ${dto.status}.`,
      );
    }
    task.status = dto.status;
    task.updatedBy = actorId;
    return this.toTaskDto(await this.taskRepository.save(task));
  }

  async addWorkLog(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
    dto: CreateWorkLogReqDto,
  ): Promise<WorkLogResDto> {
    this.assertValidWorkDate(dto.workDate);
    const durationMinutes = this.toMinutes(dto.hours);
    await this.assertProjectMember(workspaceId, projectId, actorId);

    const workLog = await this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const workLogRepository = manager.getRepository(WorkLogEntity);
      const task = await taskRepository.findOne({
        where: { id: taskId, projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      const log = await workLogRepository.save(
        workLogRepository.create({
          taskId,
          userId: actorId,
          workDate: dto.workDate,
          durationMinutes,
          description: dto.description?.trim() || null,
          createdBy: actorId,
          updatedBy: actorId,
        }),
      );
      const loggedMinutes =
        (await workLogRepository.sum('durationMinutes', { taskId })) ?? 0;
      task.loggedMinutes = loggedMinutes;
      task.remainingMinutes = Math.max(task.estimateMinutes - loggedMinutes, 0);
      task.updatedBy = actorId;
      await taskRepository.save(task);
      return log;
    });

    return this.toWorkLogDto(workLog);
  }

  async findWorkLogs(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<WorkLogResDto[]> {
    await this.findTask(workspaceId, projectId, taskId, actorId);
    const workLogs = await this.workLogRepository.find({
      where: { taskId },
      order: { workDate: 'DESC', createdAt: 'DESC' },
    });
    return plainToInstance(
      WorkLogResDto,
      workLogs.map((workLog) => this.toWorkLogData(workLog)),
    );
  }

  async updateWorkLog(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    workLogId: Uuid,
    actorId: Uuid,
    dto: UpdateWorkLogReqDto,
  ): Promise<WorkLogResDto> {
    if (dto.workDate !== undefined) {
      this.assertValidWorkDate(dto.workDate);
    }
    await this.assertProjectMember(workspaceId, projectId, actorId);

    const workLog = await this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const workLogRepository = manager.getRepository(WorkLogEntity);
      const task = await taskRepository.findOne({
        where: { id: taskId, projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      const log = await workLogRepository.findOneBy({ id: workLogId, taskId });
      if (!log) {
        throw new NotFoundException('Work log not found');
      }
      this.assertWorkLogOwner(log, actorId);
      if (dto.workDate !== undefined) {
        log.workDate = dto.workDate;
      }
      if (dto.hours !== undefined) {
        log.durationMinutes = this.toMinutes(dto.hours);
      }
      if (dto.description !== undefined) {
        log.description = dto.description?.trim() || null;
      }
      log.updatedBy = actorId;
      const savedLog = await workLogRepository.save(log);
      const loggedMinutes =
        (await workLogRepository.sum('durationMinutes', { taskId })) ?? 0;
      task.loggedMinutes = loggedMinutes;
      task.remainingMinutes = Math.max(task.estimateMinutes - loggedMinutes, 0);
      task.updatedBy = actorId;
      await taskRepository.save(task);
      return savedLog;
    });

    return this.toWorkLogDto(workLog);
  }

  async deleteWorkLog(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    workLogId: Uuid,
    actorId: Uuid,
  ): Promise<void> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    await this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const workLogRepository = manager.getRepository(WorkLogEntity);
      const task = await taskRepository.findOne({
        where: { id: taskId, projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      const workLog = await workLogRepository.findOneBy({
        id: workLogId,
        taskId,
      });
      if (!workLog) {
        throw new NotFoundException('Work log not found');
      }
      this.assertWorkLogOwner(workLog, actorId);
      await workLogRepository.remove(workLog);
      const loggedMinutes =
        (await workLogRepository.sum('durationMinutes', { taskId })) ?? 0;
      task.loggedMinutes = loggedMinutes;
      task.remainingMinutes = Math.max(task.estimateMinutes - loggedMinutes, 0);
      task.updatedBy = actorId;
      await taskRepository.save(task);
    });
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

  private async findTask(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    userId: Uuid,
  ): Promise<TaskEntity> {
    await this.assertProjectMember(workspaceId, projectId, userId);
    const task = await this.taskRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private assertWorkLogOwner(workLog: WorkLogEntity, actorId: Uuid): void {
    if (workLog.userId !== actorId) {
      throw new ForbiddenException(
        'You can only edit or delete your own work logs.',
      );
    }
  }

  private assertValidWorkDate(workDate: string): void {
    const parsed = new Date(`${workDate}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== workDate
    ) {
      throw new BadRequestException(
        'Work date must be a valid YYYY-MM-DD date.',
      );
    }
  }

  private toMinutes(hours: number, allowZero = false): number {
    const minutes = Math.round(hours * 60);
    if (allowZero && hours === 0) {
      return 0;
    }
    if (!Number.isFinite(minutes) || minutes < 1) {
      throw new BadRequestException('Hours must be at least one minute.');
    }
    return minutes;
  }

  private toTaskData(task: TaskEntity): Record<string, unknown> {
    return {
      ...task,
      parentTaskId: task.parentTaskId ?? null,
      sprintId: task.sprintId ?? null,
      estimateHours: task.estimateMinutes / 60,
      loggedHours: task.loggedMinutes / 60,
      remainingHours: task.remainingMinutes / 60,
    };
  }

  private toTaskDto(task: TaskEntity): TaskResDto {
    return plainToInstance(TaskResDto, this.toTaskData(task));
  }

  private toWorkLogData(workLog: WorkLogEntity): Record<string, unknown> {
    return {
      ...workLog,
      hours: workLog.durationMinutes / 60,
    };
  }

  private toWorkLogDto(workLog: WorkLogEntity): WorkLogResDto {
    return plainToInstance(WorkLogResDto, this.toWorkLogData(workLog));
  }
}
