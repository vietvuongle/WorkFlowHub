import { ClassField, StringField } from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class WorkspaceResDto {
  @StringField()
  @Expose()
  id!: string;

  @StringField()
  @Expose()
  name!: string;

  @StringField()
  @Expose()
  slug!: string;

  @StringField({ nullable: true })
  @Expose()
  description?: string | null;

  @StringField()
  @Expose()
  ownerId!: string;

  @ClassField(() => Date)
  @Expose()
  createdAt!: Date;

  @ClassField(() => Date)
  @Expose()
  updatedAt!: Date;
}
