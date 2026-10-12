import { StringField } from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ProjectMemberResDto {
  @StringField()
  @Expose()
  id!: string;

  @StringField()
  @Expose()
  userId!: string;

  @StringField()
  @Expose()
  email!: string;
}
