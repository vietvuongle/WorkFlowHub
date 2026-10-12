import { NumberFieldOptional } from '@/decorators/field.decorators';

export class GetSprintVelocityReqDto {
  @NumberFieldOptional({ min: 1, max: 24, int: true, default: 6 })
  readonly limit?: number = 6;
}
