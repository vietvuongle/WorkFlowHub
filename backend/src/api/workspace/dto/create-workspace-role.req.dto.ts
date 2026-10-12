import {
  StringField,
  StringFieldOptional,
} from '@/decorators/field.decorators';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  Matches,
  MinLength,
} from 'class-validator';
import { WORKSPACE_PERMISSION_CODES } from '../constants/workspace-permission.constant';

export class CreateWorkspaceRoleReqDto {
  @StringField({ maxLength: 100 })
  @Matches(/\S/)
  name!: string;

  @StringFieldOptional({ maxLength: 2000 })
  description?: string;

  @StringField({ each: true, maxLength: 100 })
  @IsArray()
  @ArrayUnique()
  @MinLength(1, { each: true })
  @IsIn(WORKSPACE_PERMISSION_CODES, { each: true })
  permissionCodes!: string[];
}
