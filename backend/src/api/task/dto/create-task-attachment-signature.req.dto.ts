import { StringField } from '@/decorators/field.decorators';
import { IsIn } from 'class-validator';

export const TASK_ATTACHMENT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type TaskAttachmentContentType =
  (typeof TASK_ATTACHMENT_CONTENT_TYPES)[number];

export class CreateTaskAttachmentSignatureReqDto {
  @StringField({ maxLength: 255 })
  fileName!: string;

  @StringField({ maxLength: 100 })
  @IsIn(TASK_ATTACHMENT_CONTENT_TYPES)
  contentType!: TaskAttachmentContentType;
}
