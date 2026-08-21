import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { JdvPayWallet } from './jdv-pay-wallet.entity';

@Entity('transactions')
@Index(['wallet_id'])
@Index(['module_source'])
@Index(['status'])
@Index(['reference_id'])
@Index(['created_at'])
@Index(['transaction_type'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  wallet_id: string;

  @ManyToOne(() => JdvPayWallet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: JdvPayWallet;

  // Transaction Details
  @Column('varchar', { length: 20 })
  transaction_type: 'DEBIT' | 'CREDIT' | 'TRANSFER' | 'REFUND' | 'COMMISSION';

  @Column('varchar', { length: 100, nullable: true })
  reference_id: string;

  // Module Source
  @Column('varchar', { length: 30 })
  module_source: string;

  @Column('varchar', { length: 100, nullable: true })
  module_transaction_id: string;

  // Amount & Currency
  @Column('numeric', { precision: 18, scale: 4 })
  amount_local: string;

  @Column('varchar', { length: 3 })
  currency_local: string;

  @Column('numeric', { precision: 18, scale: 4, nullable: true })
  amount_original: string;

  @Column('varchar', { length: 3, nullable: true })
  currency_original: string;

  @Column('numeric', { precision: 12, scale: 8, nullable: true })
  exchange_rate_used: string;

  // Fees
  @Column('numeric', { precision: 18, scale: 4, default: 0 })
  fee_amount: string;

  @Column('varchar', { length: 100, nullable: true })
  fee_reason: string;

  @Column('numeric', { precision: 18, scale: 4, nullable: true })
  net_amount: string;

  // Status & Timing
  @Column('varchar', { length: 20, default: 'PENDING' })
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

  @CreateDateColumn()
  initiated_at: Date;

  @Column('timestamp', { nullable: true })
  completed_at: Date;

  @Column('text', { nullable: true })
  failed_reason: string;

  // Reconciliation
  @Column('boolean', { default: false })
  reconciled: boolean;

  @Column('timestamp', { nullable: true })
  reconciled_at: Date;

  // Metadata
  @Column('text', { nullable: true })
  description: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
