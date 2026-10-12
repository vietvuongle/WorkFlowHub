import { ClassField, StringField } from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';
import { WorkflowStatusResDto } from './workflow-status.res.dto';

@Exclude()
export class ProjectResDto {
  @StringField()
  @Expose()
  id!: string;

  @StringField()
  @Expose()
  workspaceId!: string;

  @StringField()
  @Expose()
  name!: string;

  @StringField()
  @Expose()
  key!: string;

  @StringField({ nullable: true })
  @Expose()
  description?: string | null;

  @StringField({ nullable: true })
  @Expose()
  currentStatusId!: string | null;

  @StringField({ nullable: true })
  @Expose()
  currentStatusName?: string | null;

  @ClassField(() => WorkflowStatusResDto, { each: true })
  @Expose()
  statuses!: WorkflowStatusResDto[];

  @ClassField(() => Date)
  @Expose()
  createdAt!: Date;

  @ClassField(() => Date)
  @Expose()
  updatedAt!: Date;
}
