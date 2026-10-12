import {
  NumberField,
  StringField,
  StringFieldOptional,
} from '@/decorators/field.decorators';
import { Matches } from 'class-validator';

export class CreateWorkLogReqDto {
  @StringField({ example: '2026-10-10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  workDate!: string;

  @NumberField({ min: 1 / 60, max: 35000 })
  hours!: number;

  @StringFieldOptional({ maxLength: 2000 })
  description?: string;
}
