import { StringField, UUIDFieldOptional } from '@/decorators/field.decorators';
import { ArrayUnique, IsArray, Matches } from 'class-validator';

export class CreateTaskCommentReqDto {
  @StringField({ maxLength: 10000 })
  @Matches(/\S/)
  content!: string;

  @UUIDFieldOptional({ each: true })
  @IsArray()
  @ArrayUnique()
  mentionedUserIds!: string[];
}
