import { TokenField } from '@/decorators/field.decorators';

export class VerifyEmailReqDto {
  @TokenField()
  token!: string;
}
