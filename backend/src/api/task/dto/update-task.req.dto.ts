import {
  NumberFieldOptional,
  StringFieldOptional,
} from '@/decorators/field.decorators';
import { Matches } from 'class-validator';

export class UpdateTaskReqDto {
  @StringFieldOptional({ maxLength: 255 })
  @Matches(/\S/)
  title?: string;

  @StringFieldOptional({ maxLength: 4000 })
  description?: string;

  @NumberFieldOptional({ min: 1 / 60, max: 35000 })
  estimateHours?: number;
}
