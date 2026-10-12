import {
  StringField,
  StringFieldOptional,
} from '@/decorators/field.decorators';
import { Matches } from 'class-validator';

export class CreateWorkspaceReqDto {
  @StringField({ maxLength: 255 })
  @Matches(/\S/)
  name!: string;

  @StringFieldOptional({ maxLength: 2000 })
  description?: string;
}
