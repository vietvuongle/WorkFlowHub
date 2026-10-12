import { StringField } from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PermissionResDto {
  @StringField()
  @Expose()
  code!: string;

  @StringField({ nullable: true })
  @Expose()
  description?: string | null;
}
