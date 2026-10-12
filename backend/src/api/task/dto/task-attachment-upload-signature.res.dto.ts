import {
  NumberField,
  StringField,
  UUIDField,
} from '@/decorators/field.decorators';

export class TaskAttachmentUploadSignatureResDto {
  @UUIDField()
  attachmentId!: string;

  @StringField()
  cloudName!: string;

  @StringField()
  apiKey!: string;

  @StringField()
  resourceType!: 'image' | 'raw';

  @NumberField()
  timestamp!: number;

  @StringField()
  signature!: string;

  @StringField()
  publicId!: string;

  @StringField()
  deliveryType!: 'authenticated';

  @StringField()
  uploadPreset!: string;

  @StringField()
  allowedFormats!: string;

  @StringField()
  overwrite!: 'false';

  @StringField()
  uploadUrl!: string;

  @NumberField()
  maxFileBytes!: number;
}
