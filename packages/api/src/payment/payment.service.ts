import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JdvPayWallet } from '../database/entities/jdv-pay-wallet.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { Commission } from '../database/entities/commission.entity';
import { User } from '../database/entities/user.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(JdvPayWallet)
    private walletsRepository: Repository<JdvPayWallet>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Commission)
    private commissionsRepository: Repository<Commission>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Create or get user wallet
   */
  async createOrGetWallet(userId: string, currency: string = 'XOF') {
    let wallet = await this.walletsRepository.findOne({
      where: { user_id: userId },
    });

    if (!wallet) {
      wallet = this.walletsRepository.create({
        user_id: userId,
        currency_primary: currency,
        balance_primary: '0.0000',
        status: 'ACTIVE',
        kyc_verified: false,
      });
      wallet = await this.walletsRepository.save(wallet);
    }

    return wallet;
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(userId: string) {
    const wallet = await this.walletsRepository.findOne({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return {
      wallet_id: wallet.id,
      balance: wallet.balance_primary,
      currency: wallet.currency_primary,
      status: wallet.status,
      kyc_verified: wallet.kyc_verified,
    };
  }

  /**
   * Initiate payment transaction
   * This is called by other modules (JDV_MARKET, JDV_TRANSPORT, etc.)
   */
  async initiateTransaction(createTransactionDto: CreateTransactionDto) {
    const {
      wallet_id,
      transaction_type,
      amount_local,
      currency_local,
      module_source,
      module_transaction_id,
      description,
    } = createTransactionDto;

    // Validate wallet
    const wallet = await this.walletsRepository.findOne({
      where: { id: wallet_id },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Validate amount
    if (new Decimal(amount_local).lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Check transaction limits
    if (wallet.kyc_limit && new Decimal(amount_local).greaterThan(wallet.kyc_limit)) {
      throw new BadRequestException('Transaction exceeds KYC limit');
    }

    // Create transaction record
    const transaction = this.transactionsRepository.create({
      wallet_id,
      transaction_type,
      amount_local,
      currency_local,
      module_source,
      module_transaction_id,
      description,
      status: 'PENDING',
      initiated_at: new Date(),
    });

    const savedTransaction = await this.transactionsRepository.save(transaction);

    return {
      transaction_id: savedTransaction.id,
      status: savedTransaction.status,
      amount: savedTransaction.amount_local,
      currency: savedTransaction.currency_local,
      message: 'Transaction initiated',
    };
  }

  /**
   * Process payment (debit from wallet)
   */
  async processPayment(transactionId: string, paymentMethodId?: string) {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const wallet = await this.walletsRepository.findOne({
      where: { id: transaction.wallet_id },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Check sufficient balance
    const currentBalance = new Decimal(wallet.balance_primary);
    const transactionAmount = new Decimal(transaction.amount_local);

    if (currentBalance.lessThan(transactionAmount)) {
      transaction.status = 'FAILED';
      transaction.failed_reason = 'Insufficient balance';
      await this.transactionsRepository.save(transaction);
      throw new BadRequestException('Insufficient balance in wallet');
    }

    // Deduct from wallet
    wallet.balance_primary = currentBalance.minus(transactionAmount).toString();
    wallet.updated_at = new Date();
    await this.walletsRepository.save(wallet);

    // Mark transaction as success
    transaction.status = 'SUCCESS';
    transaction.completed_at = new Date();
    await this.transactionsRepository.save(transaction);

    return {
      transaction_id: transaction.id,
      status: 'SUCCESS',
      new_balance: wallet.balance_primary,
      currency: wallet.currency_primary,
    };
  }

  /**
   * Add funds to wallet
   */
  async addFunds(userId: string, amount: string, currency: string, description: string) {
    const wallet = await this.createOrGetWallet(userId, currency);

    // Create credit transaction
    const transaction = this.transactionsRepository.create({
      wallet_id: wallet.id,
      transaction_type: 'CREDIT',
      amount_local: amount,
      currency_local: currency,
      module_source: 'JDV_PAY',
      description: description || 'Wallet top-up',
      status: 'SUCCESS',
      initiated_at: new Date(),
      completed_at: new Date(),
    });

    const savedTransaction = await this.transactionsRepository.save(transaction);

    // Add funds to wallet
    const newBalance = new Decimal(wallet.balance_primary).plus(amount);
    wallet.balance_primary = newBalance.toString();
    wallet.updated_at = new Date();
    await this.walletsRepository.save(wallet);

    return {
      transaction_id: savedTransaction.id,
      new_balance: wallet.balance_primary,
      currency: wallet.currency_primary,
      status: 'SUCCESS',
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(userId: string, limit = 20, offset = 0) {
    const wallet = await this.walletsRepository.findOne({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const [transactions, total] = await this.transactionsRepository.findAndCount({
      where: { wallet_id: wallet.id },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.transaction_type,
        amount: t.amount_local,
        currency: t.currency_local,
        module: t.module_source,
        status: t.status,
        description: t.description,
        created_at: t.created_at,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Record commission
   */
  async recordCommission(
    walletId: string,
    commissionType: string,
    commissionRate: string,
    sourceModule: string,
    sourceTransactionId: string,
  ) {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: sourceTransactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Source transaction not found');
    }

    // Calculate commission amount
    const commissionAmount = new Decimal(transaction.amount_local)
      .times(commissionRate)
      .dividedBy(100);

    const commission = this.commissionsRepository.create({
      transaction_id: sourceTransactionId,
      wallet_id: walletId,
      commission_type: commissionType,
      commission_rate: commissionRate,
      commission_amount: commissionAmount.toString(),
      currency: transaction.currency_local,
      source_module: sourceModule,
      source_transaction_id: sourceTransactionId,
      status: 'EARNED',
      earned_at: new Date(),
    });

    const savedCommission = await this.commissionsRepository.save(commission);

    return {
      commission_id: savedCommission.id,
      amount: savedCommission.commission_amount,
      currency: savedCommission.currency,
      status: 'EARNED',
    };
  }

  /**
   * Refund transaction
   */
  async refundTransaction(transactionId: string, reason: string) {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.status !== 'SUCCESS') {
      throw new BadRequestException('Can only refund successful transactions');
    }

    const wallet = await this.walletsRepository.findOne({
      where: { id: transaction.wallet_id },
    });

    // Refund the amount
    const newBalance = new Decimal(wallet.balance_primary).plus(transaction.amount_local);
    wallet.balance_primary = newBalance.toString();
    wallet.updated_at = new Date();
    await this.walletsRepository.save(wallet);

    // Mark as refunded
    transaction.status = 'REFUNDED';
    transaction.updated_at = new Date();
    await this.transactionsRepository.save(transaction);

    return {
      transaction_id: transaction.id,
      status: 'REFUNDED',
      refunded_amount: transaction.amount_local,
      new_balance: wallet.balance_primary,
      reason,
    };
  }
}
