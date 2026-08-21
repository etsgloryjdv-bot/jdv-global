import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';
import { Decimal } from 'decimal.js';

@Entity('users')
@Unique(['email'])
@Unique(['phone_number'])
@Index(['country_iso'])
@Index(['kyc_status'])
@Index(['created_at'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 150 })
  email: string;

  @Column('varchar', { length: 20 })
  phone_number: string;

  @Column('varchar')
  password_hash: string;

  @Column('varchar', { length: 50 })
  first_name: string;

  @Column('varchar', { length: 50 })
  last_name: string;

  @Column('text', { nullable: true })
  avatar_url: string;

  @Column('text', { nullable: true })
  bio: string;

  // Location & Preferences
  @Column('varchar', { length: 3 })
  country_iso: string;

  @Column('varchar', { length: 100 })
  country_name: string;

  @Column('varchar', { length: 50, default: 'UTC' })
  timezone: string;

  @Column('varchar', { length: 5, default: 'fr' })
  default_language: string;

  @Column('varchar', { length: 3, default: 'XOF' })
  default_currency: string;

  // Account Status
  @Column('varchar', { length: 20, default: 'ACTIVE' })
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';

  @Column('boolean', { default: false })
  email_verified: boolean;

  @Column('boolean', { default: false })
  phone_verified: boolean;

  @Column('varchar', { length: 20, default: 'PENDING' })
  kyc_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

  @Column('timestamp', { nullable: true })
  kyc_verified_at: Date;

  // Security
  @Column('boolean', { default: false })
  two_factor_enabled: boolean;

  @Column('varchar', { nullable: true })
  two_factor_secret: string;

  @Column('timestamp', { nullable: true })
  last_login_at: Date;

  @Column('timestamp', { nullable: true })
  password_changed_at: Date;

  @Column('int', { default: 0 })
  login_attempts: number;

  @Column('timestamp', { nullable: true })
  account_locked_until: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column('timestamp', { nullable: true })
  deleted_at: Date;

  // Relations (defined in separate files)
  // roles: UserRole[];
  // permissions: UserPermission[];
  // wallet: JdvPayWallet;
}
