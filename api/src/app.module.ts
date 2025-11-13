import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisService } from './redis.service';
import { DatabaseModule } from './database.module';
import { User } from './entities/user.entity';
import { Transaction } from './entities/transaction.entity';
import { BalanceAudit } from './entities/balance-audit.entity';
import { UserService } from './services/user.service';
import { TransactionService } from './services/transaction.service';
import { RiskService } from './services/risk.service';
import { TransactionController } from './controllers/transaction.controller';
import { UserController } from './controllers/user.controller';
import { RiskController } from './controllers/risk.controller';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([User, Transaction, BalanceAudit]),
  ],
  controllers: [AppController, TransactionController, UserController, RiskController],
  providers: [AppService, RedisService, UserService, TransactionService, RiskService],
})
export class AppModule {}