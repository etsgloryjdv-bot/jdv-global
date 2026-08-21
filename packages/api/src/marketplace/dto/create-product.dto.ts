import { IsUUID, IsNotEmpty, IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateProductDto {
  @IsUUID()
  @IsNotEmpty()
  category_id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  price_base: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  stock_quantity?: number;
}
