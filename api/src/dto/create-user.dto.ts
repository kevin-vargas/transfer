import { IsString, IsEmail, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number;
}