import { ClassField, StringField } from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class WorkflowStatusResDto {
  @StringField()
  @Expose()
  id!: string;

  @StringField()
  @Expose()
  key!: string;

  @StringField()
  @Expose()
  name!: string;

  @ClassField(() => Number)
  @Expose()
  position!: number;

  @ClassField(() => Boolean)
  @Expose()
  isInitial!: boolean;

  @ClassField(() => Boolean)
  @Expose()
  isFinal!: boolean;
}
