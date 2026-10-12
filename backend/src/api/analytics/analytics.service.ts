import { Uuid } from '@/common/types/common.type';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import { SprintEntity, SprintStatus } from '../sprint/entities/sprint.entity';
import { TaskEntity, TaskStatus } from '../task/entities/task.entity';
import { WorkLogEntity } from '../task/entities/work-log.entity';
import {
  CycleTimeResDto,
  ProjectAnalyticsSummaryResDto,
  SprintBurndownResDto,
  SprintVelocityResDto,
  TaskStatusCountResDto,
} from './dto/analytics.res.dto';
import { GetSprintVelocityReqDto } from './dto/get-sprint-velocity.req.dto';

interface TaskSummaryRow {
  status: TaskStatus;
  taskCount: string | number;
  estimateMinutes: string | number;
  loggedMinutes: string | number;
  remainingMinutes: string | number;
}

interface CycleTimeRow {
  completedTasks: string | number;
  averageDays: string | number;
  medianDays: string | number;
}

const TASK_STATUSES = Object.values(TaskStatus);
const MAX_BURNDOWN_DAYS = 366;

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMemberRepository: Repository<ProjectMemberEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(SprintEntity)
    private readonly sprintRepository: Repository<SprintEntity>,
    @InjectRepository(WorkLogEntity)
    private readonly workLogRepository: Repository<WorkLogEntity>,
  ) {}

  async getProjectSummary(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
  ): Promise<ProjectAnalyticsSummaryResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const rows = (await this.taskRepository.query(
      `
        SELECT
          "status" AS "status",
          COUNT(*)::int AS "taskCount",
          COALESCE(SUM("estimate_minutes"), 0)::int AS "estimateMinutes",
          COALESCE(SUM("logged_minutes"), 0)::int AS "loggedMinutes",
          COALESCE(SUM("remaining_minutes"), 0)::int AS "remainingMinutes"
        FROM "tasks"
        WHERE "project_id" = $1
        GROUP BY "status"
      `,
      [projectId],
    )) as TaskSummaryRow[];

    const byStatus = TASK_STATUSES.map((status) => {
      const row = rows.find((item) => item.status === status);
      return {
        status,
        count: row ? Number(row.taskCount) : 0,
      } as TaskStatusCountResDto;
    });
    const totalTasks = byStatus.reduce((sum, row) => sum + row.count, 0);
    const completedTasks =
      byStatus.find((row) => row.status === TaskStatus.DONE)?.count ?? 0;

    return {
      totalTasks,
      completedTasks,
      completionPercent:
        totalTasks === 0 ? 0 : this.round((completedTasks / totalTasks) * 100),
      estimatedHours: this.minutesToHours(
        rows.reduce((sum, row) => sum + Number(row.estimateMinutes), 0),
      ),
      loggedHours: this.minutesToHours(
        rows.reduce((sum, row) => sum + Number(row.loggedMinutes), 0),
      ),
      remainingHours: this.minutesToHours(
        rows.reduce((sum, row) => sum + Number(row.remainingMinutes), 0),
      ),
      byStatus,
    };
  }

  async getSprintVelocity(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
    reqDto: GetSprintVelocityReqDto,
  ): Promise<SprintVelocityResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const sprints = await this.sprintRepository.find({
      where: { projectId, status: SprintStatus.COMPLETED },
      order: { completedAt: 'DESC' },
      take: reqDto.limit ?? 6,
    });
    const tasks = sprints.length
      ? await this.taskRepository.find({
          where: {
            projectId,
            sprintId: In(sprints.map((sprint) => sprint.id)),
            status: TaskStatus.DONE,
          },
          select: { sprintId: true, estimateMinutes: true },
        })
      : [];

    const items = sprints.map((sprint) => {
      const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id);
      const completedEstimateMinutes = sprintTasks.reduce(
        (sum, task) => sum + task.estimateMinutes,
        0,
      );
      return {
        sprintId: sprint.id,
        sprintName: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        completedAt: sprint.completedAt ?? null,
        completedTaskCount: sprintTasks.length,
        completedEstimateHours: this.minutesToHours(completedEstimateMinutes),
      };
    });
    const totalVelocity = items.reduce(
      (sum, sprint) => sum + sprint.completedEstimateHours,
      0,
    );

    return {
      sampleSize: items.length,
      averageEstimateHours:
        items.length === 0 ? 0 : this.round(totalVelocity / items.length),
      sprints: items,
    };
  }

  async getCycleTime(
    workspaceId: Uuid,
    projectId: Uuid,
    actorId: Uuid,
  ): Promise<CycleTimeResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const rows = (await this.taskRepository.query(
      `
        WITH task_starts AS (
          SELECT
            "entity_id",
            MIN("created_at") AS "started_at"
          FROM "activity_logs"
          WHERE "project_id" = $1
            AND "entity_type" = 'TASK'
            AND "action" = 'updated'
            AND "metadata" ->> 'status' = $2
          GROUP BY "entity_id"
        ),
        task_cycles AS (
          SELECT
            task_starts."entity_id",
            task_starts."started_at",
            MIN(completion."created_at") AS "completed_at"
          FROM task_starts
          INNER JOIN "activity_logs" completion
            ON completion."entity_id" = task_starts."entity_id"
            AND completion."project_id" = $1
            AND completion."entity_type" = 'TASK'
            AND completion."action" = 'updated'
            AND completion."metadata" ->> 'status' = $3
            AND completion."created_at" >= task_starts."started_at"
          GROUP BY task_starts."entity_id", task_starts."started_at"
        ),
        valid_cycles AS (
          SELECT EXTRACT(EPOCH FROM ("completed_at" - "started_at")) / 86400.0
            AS "cycle_days"
          FROM task_cycles
        )
        SELECT
          COUNT(*)::int AS "completedTasks",
          COALESCE(AVG("cycle_days"), 0)::float8 AS "averageDays",
          COALESCE(
            percentile_cont(0.5) WITHIN GROUP (ORDER BY "cycle_days"),
            0
          )::float8 AS "medianDays"
        FROM valid_cycles
      `,
      [projectId, TaskStatus.IN_PROGRESS, TaskStatus.DONE],
    )) as CycleTimeRow[];
    const row = rows[0];

    return {
      completedTasks: Number(row?.completedTasks ?? 0),
      averageDays: this.round(Number(row?.averageDays ?? 0)),
      medianDays: this.round(Number(row?.medianDays ?? 0)),
    };
  }

  async getSprintBurndown(
    workspaceId: Uuid,
    projectId: Uuid,
    sprintId: Uuid,
    actorId: Uuid,
  ): Promise<SprintBurndownResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const sprint = await this.sprintRepository.findOne({
      where: { id: sprintId, projectId },
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const dayCount = this.daysBetween(sprint.startDate, sprint.endDate) + 1;
    if (!Number.isInteger(dayCount) || dayCount < 1) {
      throw new BadRequestException('Sprint has an invalid date range.');
    }
    if (dayCount > MAX_BURNDOWN_DAYS) {
      throw new BadRequestException(
        `Burndown reports are limited to ${MAX_BURNDOWN_DAYS} days.`,
      );
    }

    const tasks = await this.taskRepository.find({
      where: { projectId, sprintId },
      select: { id: true, estimateMinutes: true },
    });
    const taskIds = tasks.map((task) => task.id);
    const workLogs = taskIds.length
      ? await this.workLogRepository.find({
          where: {
            taskId: In(taskIds),
            workDate: Between(sprint.startDate, sprint.endDate),
          },
          select: { workDate: true, durationMinutes: true },
          order: { workDate: 'ASC' },
        })
      : [];

    const scopeMinutes = tasks.reduce(
      (sum, task) => sum + task.estimateMinutes,
      0,
    );
    const loggedMinutesByDate = new Map<string, number>();
    for (const workLog of workLogs) {
      loggedMinutesByDate.set(
        workLog.workDate,
        (loggedMinutesByDate.get(workLog.workDate) ?? 0) +
          workLog.durationMinutes,
      );
    }

    let cumulativeLoggedMinutes = 0;
    const points = Array.from({ length: dayCount }, (_, index) => {
      const date = this.addDays(sprint.startDate, index);
      cumulativeLoggedMinutes += loggedMinutesByDate.get(date) ?? 0;
      const remainingFraction =
        dayCount <= 1 ? 0 : (dayCount - index - 1) / (dayCount - 1);
      return {
        date,
        idealRemainingHours: this.minutesToHours(
          Math.round(scopeMinutes * remainingFraction),
        ),
        actualRemainingHours: this.minutesToHours(
          Math.max(scopeMinutes - cumulativeLoggedMinutes, 0),
        ),
      };
    });

    return {
      sprintId,
      scopeEstimateHours: this.minutesToHours(scopeMinutes),
      points,
    };
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

  private minutesToHours(minutes: number): number {
    return this.round(minutes / 60);
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private daysBetween(startDate: string, endDate: string): number {
    return (
      (Date.parse(`${endDate}T00:00:00.000Z`) -
        Date.parse(`${startDate}T00:00:00.000Z`)) /
      86_400_000
    );
  }

  private addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }
}
