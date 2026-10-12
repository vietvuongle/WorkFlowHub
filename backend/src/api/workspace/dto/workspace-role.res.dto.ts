import { ClassField, StringField } from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';
import { PermissionResDto } from './permission.res.dto';

@Exclude()
export class WorkspaceRoleResDto {
  @StringField()
  @Expose()
  id!: string;

  @StringField()
  @Expose()
  name!: string;

  @StringField({ nullable: true })
  @Expose()
  description?: string | null;

  @ClassField(() => Boolean)
  @Expose()
  isSystem!: boolean;

  @ClassField(() => PermissionResDto, { each: true })
  @Expose()
  permissions!: PermissionResDto[];
}
