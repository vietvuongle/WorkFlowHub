import {
  ClassField,
  StringField,
  UUIDField,
  UUIDFieldOptional,
} from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';
import { NotificationType } from '../entities/notification.entity';

@Exclude()
export class NotificationResDto {
  @UUIDField()
  @Expose()
  id!: string;

  @StringField()
  @Expose()
  type!: NotificationType;

  @UUIDFieldOptional({ nullable: true })
  @Expose()
  actorUserId!: string | null;

  @UUIDField()
  @Expose()
  taskId!: string;

  @UUIDField()
  @Expose()
  commentId!: string;

  @StringField()
  @Expose()
  taskKey!: string;

  @StringField()
  @Expose()
  contentPreview!: string;

  @ClassField(() => Date, { nullable: true })
  @Expose()
  readAt!: Date | null;

  @ClassField(() => Date)
  @Expose()
  createdAt!: Date;
}
