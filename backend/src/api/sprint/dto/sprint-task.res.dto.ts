import {
  NumberField,
  StringField,
  UUIDField,
} from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class SprintTaskResDto {
  @UUIDField()
  @Expose()
  id!: string;

  @StringField()
  @Expose()
  key!: string;

  @StringField()
  @Expose()
  title!: string;

  @StringField()
  @Expose()
  status!: string;

  @NumberField()
  @Expose()
  estimateHours!: number;

  @NumberField()
  @Expose()
  loggedHours!: number;

  @NumberField()
  @Expose()
  remainingHours!: number;
}
