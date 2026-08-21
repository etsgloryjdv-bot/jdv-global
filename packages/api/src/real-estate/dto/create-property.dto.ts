import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  property_type: string; // HOUSE, APARTMENT, LAND, COMMERCIAL

  @IsNumber()
  @IsOptional()
  @Min(0)
  bedrooms?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  bathrooms?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  total_area?: number;

  @IsString()
  @IsNotEmpty()
  street_address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsOptional()
  state_province?: string;

  @IsString()
  @IsOptional()
  postal_code?: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  price_amount: number;

  @IsString()
  @IsNotEmpty()
  price_currency: string;

  @IsString()
  @IsOptional()
  price_type?: string; // SALE, RENT, BOTH

  @IsBoolean()
  @IsOptional()
  pet_friendly?: boolean;

  @IsBoolean()
  @IsOptional()
  smoking_allowed?: boolean;
}
