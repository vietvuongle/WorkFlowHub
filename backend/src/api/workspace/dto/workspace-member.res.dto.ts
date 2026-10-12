import { ClassField, StringField } from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';
import { WorkspaceMemberStatus } from '../entities/workspace-member.entity';
import { WorkspaceRoleResDto } from './workspace-role.res.dto';

@Exclude()
export class WorkspaceMemberResDto {
  @StringField()
  @Expose()
  id!: string;

  @StringField()
  @Expose()
  userId!: string;

  @StringField()
  @Expose()
  email!: string;

  @StringField({ nullable: true })
  @Expose()
  username?: string | null;

  @ClassField(() => WorkspaceRoleResDto)
  @Expose()
  role!: WorkspaceRoleResDto;

  @StringField()
  @Expose()
  status!: WorkspaceMemberStatus;

  @ClassField(() => Date)
  @Expose()
  joinedAt?: Date | null;
}
