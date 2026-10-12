import { PageOptionsDto } from '@/common/dto/offset-pagination/page-options.dto';
import {
  EnumFieldOptional,
  NumberFieldOptional,
  StringFieldOptional,
  UUIDFieldOptional,
} from '@/decorators/field.decorators';
import { TaskStatus } from '../entities/task.entity';

export enum TaskSortBy {
  NUMBER = 'number',
  TITLE = 'title',
  STATUS = 'status',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  ESTIMATE = 'estimateMinutes',
  LOGGED = 'loggedMinutes',
  REMAINING = 'remainingMinutes',
}

export class SearchTasksReqDto extends PageOptionsDto {
  @NumberFieldOptional({ min: 1, max: 100, int: true, default: 10 })
  override readonly limit?: number = 10;

  @StringFieldOptional({ maxLength: 100 })
  override readonly q?: string = undefined;

  @EnumFieldOptional(() => TaskStatus)
  readonly status?: TaskStatus;

  @UUIDFieldOptional()
  readonly sprintId?: string;

  @UUIDFieldOptional()
  readonly parentTaskId?: string;

  @EnumFieldOptional(() => TaskSortBy, { default: TaskSortBy.NUMBER })
  readonly sortBy?: TaskSortBy = TaskSortBy.NUMBER;
}
