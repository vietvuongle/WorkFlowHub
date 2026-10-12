import { EmailField, UUIDField } from '@/decorators/field.decorators';

export class AddWorkspaceMemberReqDto {
  @EmailField({ toLowerCase: true })
  email!: string;

  @UUIDField()
  roleId!: string;
}
