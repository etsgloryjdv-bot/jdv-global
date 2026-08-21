import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentService } from './payment.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('api/v1/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('wallet')
  @UseGuards(JwtAuthGuard)
  async createWallet(@Request() req) {
    const userId = req.user.sub;
    const currency = req.body.currency || 'XOF';
    return this.paymentService.createOrGetWallet(userId, currency);
  }

  @Get('wallet/balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@Request() req) {
    const userId = req.user.sub;
    return this.paymentService.getWalletBalance(userId);
  }

  @Post('transaction/initiate')
  @UseGuards(JwtAuthGuard)
  async initiateTransaction(@Body() createTransactionDto: CreateTransactionDto) {
    return this.paymentService.initiateTransaction(createTransactionDto);
  }

  @Post('transaction/:transactionId/process')
  @UseGuards(JwtAuthGuard)
  async processPayment(
    @Param('transactionId') transactionId: string,
    @Body() body: { paymentMethodId?: string },
  ) {
    return this.paymentService.processPayment(transactionId, body.paymentMethodId);
  }

  @Post('wallet/add-funds')
  @UseGuards(JwtAuthGuard)
  async addFunds(
    @Request() req,
    @Body() body: { amount: string; currency?: string; description?: string },
  ) {
    const userId = req.user.sub;
    return this.paymentService.addFunds(
      userId,
      body.amount,
      body.currency || 'XOF',
      body.description,
    );
  }

  @Get('transaction/history')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @Request() req,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    const userId = req.user.sub;
    return this.paymentService.getTransactionHistory(userId, limit, offset);
  }

  @Post('transaction/:transactionId/refund')
  @UseGuards(JwtAuthGuard)
  async refundTransaction(
    @Param('transactionId') transactionId: string,
    @Body() body: { reason: string },
  ) {
    return this.paymentService.refundTransaction(transactionId, body.reason);
  }
}
