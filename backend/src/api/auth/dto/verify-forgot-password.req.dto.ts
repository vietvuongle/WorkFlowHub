import { TokenField } from '@/decorators/field.decorators';

export class VerifyForgotPasswordReqDto {
  @TokenField()
  token!: string;
}
