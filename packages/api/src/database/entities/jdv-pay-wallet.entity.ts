import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('jdv_pay_wallets')
@Index(['user_id'])
@Index(['status'])
export class JdvPayWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Balance Information
  @Column('numeric', { precision: 18, scale: 4, default: 0 })
  balance_primary: string; // Use string to handle precise decimal values

  @Column('varchar', { length: 3 })
  currency_primary: string;

  @Column('numeric', { precision: 18, scale: 4, nullable: true })
  balance_secondary: string;

  @Column('varchar', { length: 3, nullable: true })
  currency_secondary: string;

  // Wallet Status
  @Column('varchar', { length: 20, default: 'ACTIVE' })
  status: 'ACTIVE' | 'SUSPENDED' | 'FROZEN' | 'CLOSED';

  @Column('boolean', { default: true })
  is_default: boolean;

  // Verification & KYC
  @Column('boolean', { default: false })
  kyc_verified: boolean;

  @Column('numeric', { precision: 18, scale: 4, nullable: true })
  kyc_limit: string;

  @Column('numeric', { precision: 18, scale: 4, nullable: true })
  daily_transaction_limit: string;

  @Column('numeric', { precision: 18, scale: 4, nullable: true })
  monthly_transaction_limit: string;

  // Anti-Money Laundering
  @Column('int', { default: 0 })
  aml_risk_score: number;

  @Column('boolean', { default: false })
  aml_flagged: boolean;

  @Column('timestamp', { nullable: true })
  aml_last_check: Date;

  @CreateDateColumn()
  created_at: Date;

  @Column('timestamp', { onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
