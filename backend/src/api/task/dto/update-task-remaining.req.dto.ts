import { NumberField } from '@/decorators/field.decorators';

export class UpdateTaskRemainingReqDto {
  @NumberField({ min: 0, max: 35000 })
  remainingHours!: number;
}
