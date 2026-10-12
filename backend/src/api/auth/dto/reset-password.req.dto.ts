import { PasswordField, TokenField } from '@/decorators/field.decorators';

export class ResetPasswordReqDto {
  @TokenField()
  token!: string;

  @PasswordField()
  password!: string;
}
