import { IsNotEmpty, IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateRideDto {
  @IsString()
  @IsNotEmpty()
  pickup_location: string;

  @IsString()
  @IsNotEmpty()
  dropoff_location: string;

  @IsString()
  @IsOptional()
  pickup_address?: string;

  @IsString()
  @IsOptional()
  dropoff_address?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  distance_km?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  estimated_duration_minutes?: number;
}
