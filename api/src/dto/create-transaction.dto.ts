import { IsUUID, IsNumber, IsPositive } from 'class-validator';

export class CreateTransactionDto {
  @IsUUID()
  originUserId!: string;

  @IsUUID()
  destinationUserId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}