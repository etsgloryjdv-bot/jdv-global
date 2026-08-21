import { IsUUID, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  product_id: string;

  @IsUUID()
  @IsNotEmpty()
  seller_id: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  quantity: number;
}
