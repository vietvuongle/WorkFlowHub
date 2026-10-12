import {
  StringField,
  StringFieldOptional,
} from '@/decorators/field.decorators';
import { Matches } from 'class-validator';

export class CreateProjectReqDto {
  @StringField({ maxLength: 255 })
  @Matches(/\S/)
  name!: string;

  @StringField({ maxLength: 10, toUpperCase: true })
  @Matches(/^[A-Z][A-Z0-9]{1,9}$/)
  key!: string;

  @StringFieldOptional({ maxLength: 2000 })
  description?: string;
}
