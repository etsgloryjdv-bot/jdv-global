import { IsNotEmpty, IsString, IsNumber, IsDateString, Min } from 'class-validator';

export class RegisterDriverDto {
  @IsString()
  @IsNotEmpty()
  license_number: string;

  @IsDateString()
  @IsNotEmpty()
  license_expiry_date: string;

  @IsString()
  @IsNotEmpty()
  vehicle_make: string;

  @IsString()
  @IsNotEmpty()
  vehicle_model: string;

  @IsString()
  @IsNotEmpty()
  vehicle_color: string;
}
