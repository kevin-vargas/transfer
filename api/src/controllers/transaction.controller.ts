import { Controller, Post, Get, Patch, Param, Body, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { TransactionService } from '../services/transaction.service';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { Transaction } from '../entities/transaction.entity';

@Controller('transactions')
@UsePipes(new ValidationPipe({ transform: true }))
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  async createTransaction(@Body() createTransactionDto: CreateTransactionDto): Promise<Transaction> {
    return this.transactionService.createTransaction(
      createTransactionDto.originUserId,
      createTransactionDto.destinationUserId,
      createTransactionDto.amount,
    );
  }

  @Get()
  async getUserTransactions(@Query('userId') userId: string): Promise<Transaction[]> {
    if (!userId) {
      return [];
    }
    return this.transactionService.getUserTransactions(userId);
  }

  @Patch(':id/approve')
  async approveTransaction(@Param('id') id: string): Promise<Transaction> {
    return this.transactionService.approveTransaction(id);
  }

  @Patch(':id/reject')
  async rejectTransaction(@Param('id') id: string): Promise<Transaction> {
    return this.transactionService.rejectTransaction(id);
  }
}