import {
  ClassField,
  StringField,
  UUIDField,
} from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class TaskCommentResDto {
  @UUIDField()
  @Expose()
  id!: string;

  @UUIDField()
  @Expose()
  taskId!: string;

  @UUIDField()
  @Expose()
  authorUserId!: string;

  @StringField()
  @Expose()
  content!: string;

  @UUIDField({ each: true })
  @Expose()
  mentionedUserIds!: string[];

  @ClassField(() => Date)
  @Expose()
  createdAt!: Date;
}
