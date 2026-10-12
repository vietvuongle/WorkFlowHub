import { BooleanField } from '@/decorators/field.decorators';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class VerifyForgotPasswordResDto {
  @BooleanField()
  @Expose()
  valid!: boolean;
}
