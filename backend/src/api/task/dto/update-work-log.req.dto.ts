import {
  NumberFieldOptional,
  StringFieldOptional,
} from '@/decorators/field.decorators';
import { Matches } from 'class-validator';

export class UpdateWorkLogReqDto {
  @StringFieldOptional({ example: '2026-10-10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  workDate?: string;

  @NumberFieldOptional({ min: 1 / 60, max: 35000 })
  hours?: number;

  @StringFieldOptional({ maxLength: 2000, nullable: true })
  description?: string | null;
}
