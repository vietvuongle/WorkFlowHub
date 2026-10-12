import {
  NumberField,
  StringField,
  StringFieldOptional,
  UUIDFieldOptional,
} from '@/decorators/field.decorators';
import { Matches } from 'class-validator';

export class CreateTaskReqDto {
  @StringField({ maxLength: 255 })
  @Matches(/\S/)
  title!: string;

  @StringFieldOptional({ maxLength: 4000 })
  description?: string;

  @NumberField({ min: 1 / 60, max: 35000 })
  estimateHours!: number;

  @UUIDFieldOptional()
  parentTaskId?: string;
}
