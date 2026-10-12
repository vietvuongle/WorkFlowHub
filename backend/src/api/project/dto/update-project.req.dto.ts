import { StringFieldOptional } from '@/decorators/field.decorators';
import { Matches } from 'class-validator';

export class UpdateProjectReqDto {
  @StringFieldOptional({ maxLength: 255 })
  @Matches(/\S/)
  name?: string;

  @StringFieldOptional({ maxLength: 2000 })
  description?: string;
}
