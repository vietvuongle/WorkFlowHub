import {
  ClassField,
  NumberField,
  StringField,
  UUIDField,
} from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class TaskAttachmentResDto {
  @UUIDField()
  @Expose()
  id!: string;

  @StringField()
  @Expose()
  fileName!: string;

  @StringField()
  @Expose()
  contentType!: string;

  @NumberField()
  @Expose()
  sizeBytes!: number;

  @StringField()
  @Expose()
  format!: string;

  @StringField()
  @Expose()
  downloadUrl!: string;

  @ClassField(() => Date)
  @Expose()
  createdAt!: Date;
}
