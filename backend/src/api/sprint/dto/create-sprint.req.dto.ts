import {
  StringField,
  StringFieldOptional,
} from '@/decorators/field.decorators';
import { Matches } from 'class-validator';

export class CreateSprintReqDto {
  @StringField({ maxLength: 100 })
  @Matches(/\S/)
  name!: string;

  @StringFieldOptional({ maxLength: 2000 })
  goal?: string;

  @StringField({ example: '2026-10-10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @StringField({ example: '2026-10-24' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;
}
