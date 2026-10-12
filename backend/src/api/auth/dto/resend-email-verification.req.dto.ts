import { EmailField } from '@/decorators/field.decorators';

export class ResendEmailVerificationReqDto {
  @EmailField()
  email!: string;
}
