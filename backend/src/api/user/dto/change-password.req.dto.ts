import { PasswordField } from '@/decorators/field.decorators';

export class ChangePasswordReqDto {
  @PasswordField()
  currentPassword!: string;

  @PasswordField()
  newPassword!: string;
}
