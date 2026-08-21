import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

// Entities
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { UserPermission } from './entities/user-permission.entity';
import { KYCSubmission } from './entities/kyc-submission.entity';
import { JdvPayWallet } from './entities/jdv-pay-wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { Commission } from './entities/commission.entity';
import { MarketCategory } from './entities/market-category.entity';
import { MarketProduct } from './entities/market-product.entity';
import { MarketOrder } from './entities/market-order.entity';
import { ImmoProperty } from './entities/immo-property.entity';
import { TransportDriver } from './entities/transport-driver.entity';
import { TransportRide } from './entities/transport-ride.entity';
import { Notification } from './entities/notification.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Currency } from './entities/currency.entity';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { Country } from './entities/country.entity';
import { PaymentProviderConfig } from './entities/payment-provider-config.entity';

// Schemas (MongoDB)
import { AnalyticsSchema } from './schemas/analytics.schema';
import { EventSchema } from './schemas/event.schema';
import { LogSchema } from './schemas/log.schema';
import { ReviewSchema } from './schemas/review.schema';
import { MessageSchema } from './schemas/message.schema';
import { ConversationSchema } from './schemas/conversation.schema';
import { NotificationPreferenceSchema } from './schemas/notification-preference.schema';

@Module({
  imports: [
    // PostgreSQL with TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST', 'localhost'),
        port: configService.get('DATABASE_PORT', 5432),
        username: configService.get('DATABASE_USERNAME', 'postgres'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME', 'jdv_global'),
        entities: [
          User,
          UserRole,
          UserPermission,
          KYCSubmission,
          JdvPayWallet,
          Transaction,
          Commission,
          MarketCategory,
          MarketProduct,
          MarketOrder,
          ImmoProperty,
          TransportDriver,
          TransportRide,
          Notification,
          AuditLog,
          Currency,
          ExchangeRate,
          Country,
          PaymentProviderConfig,
        ],
        synchronize: false,
        logging: process.env.NODE_ENV !== 'production',
        poolSize: configService.get('DATABASE_POOL_SIZE', 20),
        ssl: process.env.NODE_ENV === 'production',
      }),
    }),

    // MongoDB with Mongoose
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get('MONGO_URI'),
        maxPoolSize: 10,
        minPoolSize: 5,
      }),
    }),

    // TypeORM Feature Modules
    TypeOrmModule.forFeature([
      User,
      UserRole,
      UserPermission,
      KYCSubmission,
      JdvPayWallet,
      Transaction,
      Commission,
      MarketCategory,
      MarketProduct,
      MarketOrder,
      ImmoProperty,
      TransportDriver,
      TransportRide,
      Notification,
      AuditLog,
      Currency,
      ExchangeRate,
      Country,
      PaymentProviderConfig,
    ]),

    // Mongoose Feature Modules
    MongooseModule.forFeature([
      { name: 'Analytics', schema: AnalyticsSchema },
      { name: 'Event', schema: EventSchema },
      { name: 'Log', schema: LogSchema },
      { name: 'Review', schema: ReviewSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'NotificationPreference', schema: NotificationPreferenceSchema },
    ]),
  ],
  exports: [TypeOrmModule, MongooseModule],
})
export class DatabaseModule {}
