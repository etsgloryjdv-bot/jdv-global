import { IsUUID, IsNotEmpty, IsDecimal, IsString, IsOptional } from 'class-validator';

export class CreateTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  wallet_id: string;

  @IsString()
  @IsNotEmpty()
  transaction_type: 'DEBIT' | 'CREDIT' | 'TRANSFER' | 'REFUND' | 'COMMISSION';

  @IsString()
  @IsNotEmpty()
  amount_local: string;

  @IsString()
  @IsNotEmpty()
  currency_local: string;

  @IsString()
  @IsNotEmpty()
  module_source: string;

  @IsOptional()
  @IsString()
  module_transaction_id?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
