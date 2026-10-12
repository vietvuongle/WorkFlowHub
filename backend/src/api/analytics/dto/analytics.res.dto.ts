import {
  ClassField,
  EnumField,
  NumberField,
  StringField,
  UUIDField,
} from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';
import { TaskStatus } from '../../task/entities/task.entity';

@Exclude()
export class TaskStatusCountResDto {
  @EnumField(() => TaskStatus)
  @Expose()
  status!: TaskStatus;

  @NumberField()
  @Expose()
  count!: number;
}

@Exclude()
export class ProjectAnalyticsSummaryResDto {
  @NumberField()
  @Expose()
  totalTasks!: number;

  @NumberField()
  @Expose()
  completedTasks!: number;

  @NumberField()
  @Expose()
  completionPercent!: number;

  @NumberField()
  @Expose()
  estimatedHours!: number;

  @NumberField()
  @Expose()
  loggedHours!: number;

  @NumberField()
  @Expose()
  remainingHours!: number;

  @ClassField(() => TaskStatusCountResDto, { each: true })
  @Expose()
  byStatus!: TaskStatusCountResDto[];
}

@Exclude()
export class SprintVelocityItemResDto {
  @UUIDField()
  @Expose()
  sprintId!: string;

  @StringField()
  @Expose()
  sprintName!: string;

  @StringField()
  @Expose()
  startDate!: string;

  @StringField()
  @Expose()
  endDate!: string;

  @ClassField(() => Date, { nullable: true })
  @Expose()
  completedAt!: Date | null;

  @NumberField()
  @Expose()
  completedTaskCount!: number;

  @NumberField()
  @Expose()
  completedEstimateHours!: number;
}

@Exclude()
export class SprintVelocityResDto {
  @NumberField()
  @Expose()
  sampleSize!: number;

  @NumberField()
  @Expose()
  averageEstimateHours!: number;

  @ClassField(() => SprintVelocityItemResDto, { each: true })
  @Expose()
  sprints!: SprintVelocityItemResDto[];
}

@Exclude()
export class CycleTimeResDto {
  @NumberField()
  @Expose()
  completedTasks!: number;

  @NumberField()
  @Expose()
  averageDays!: number;

  @NumberField()
  @Expose()
  medianDays!: number;
}

@Exclude()
export class BurndownPointResDto {
  @StringField()
  @Expose()
  date!: string;

  @NumberField()
  @Expose()
  idealRemainingHours!: number;

  @NumberField()
  @Expose()
  actualRemainingHours!: number;
}

@Exclude()
export class SprintBurndownResDto {
  @UUIDField()
  @Expose()
  sprintId!: string;

  @NumberField()
  @Expose()
  scopeEstimateHours!: number;

  @ClassField(() => BurndownPointResDto, { each: true })
  @Expose()
  points!: BurndownPointResDto[];
}
