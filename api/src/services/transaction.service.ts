import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transaction, TransactionState } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { UserService } from './user.service';
import { RedisService } from '../redis.service';
import { AuditOperation } from '../entities/balance-audit.entity';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

const MANUAL_APPROVAL_THRESHOLD = 50000;
const DEDUP_TTL_MINUTES = parseInt(process.env.TRANSACTION_DEDUP_TTL_MINUTES || '5');

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private userService: UserService,
    private dataSource: DataSource,
    private redisService: RedisService,
  ) {}

  async createTransaction(
    originUserId: string,
    destinationUserId: string,
    amount: number,
  ): Promise<Transaction> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (originUserId === destinationUserId) {
      throw new BadRequestException('Cannot send money to yourself');
    }

    // Check for duplicate transaction
    await this.checkDuplicateTransaction(originUserId, destinationUserId, amount);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { origin: originUser, destination: destinationUser } = await this.lockUsersSafely(
        originUserId,
        destinationUserId,
        queryRunner,
      );

      const pendingAmount = await this.getPendingOutgoingAmount(originUserId, queryRunner);
      const availableBalance = originUser.balance - pendingAmount;

      if (availableBalance < amount) {
        throw new BadRequestException(
          `Insufficient funds. Available: ${availableBalance}, Required: ${amount}`,
        );
      }

      const transaction = queryRunner.manager.create(Transaction, {
        originUserId,
        destinationUserId,
        amount,
        date: new Date(),
        state: amount > MANUAL_APPROVAL_THRESHOLD ? TransactionState.PENDING : TransactionState.CONFIRMED,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      if (amount <= MANUAL_APPROVAL_THRESHOLD) {
        await this.processConfirmedTransaction(
          savedTransaction,
          originUser,
          destinationUser,
          queryRunner,
        );
      }

      await queryRunner.commitTransaction();
      return savedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async approveTransaction(transactionId: string): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaction = await this.validatePendingTransaction(transactionId, queryRunner);

      const { origin: originUser, destination: destinationUser } = await this.lockUsersSafely(
        transaction.originUserId,
        transaction.destinationUserId,
        queryRunner,
      );

      const pendingAmount = await this.getPendingOutgoingAmount(originUser.id, queryRunner);
      // Subtract the SAME transaction you're approving, otherwise it's double counted
      const pendingMinusThis = pendingAmount - transaction.amount;
      const availableBalance = originUser.balance - pendingMinusThis;

      if (availableBalance < transaction.amount) {
        throw new BadRequestException('Insufficient funds');
      }

      transaction.state = TransactionState.CONFIRMED;
      const updatedTransaction = await queryRunner.manager.save(transaction);

      await this.processConfirmedTransaction(transaction, originUser, destinationUser, queryRunner);

      await queryRunner.commitTransaction();
      return updatedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectTransaction(transactionId: string): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaction = await this.validatePendingTransaction(transactionId, queryRunner);
      
      // Lock users to prevent concurrent operations
      await this.lockUsersSafely(
        transaction.originUserId,
        transaction.destinationUserId,
        queryRunner,
      );
      
      transaction.state = TransactionState.REJECTED;
      const updatedTransaction = await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();
      return updatedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: [{ originUserId: userId }, { destinationUserId: userId }],
      order: { date: 'DESC' },
      relations: ['originUser', 'destinationUser'],
    });
  }

  private async processConfirmedTransaction(
    transaction: Transaction,
    originUser: User,
    destinationUser: User,
    queryRunner: any,
  ): Promise<void> {
    const originPreviousBalance = originUser.balance;
    const originNewBalance = originUser.balance - transaction.amount;
    
    const destinationPreviousBalance = destinationUser.balance;
    const destinationNewBalance = destinationUser.balance + transaction.amount;

    await this.userService.updateBalance(originUser, originNewBalance, queryRunner);
    await this.userService.updateBalance(destinationUser, destinationNewBalance, queryRunner);

    await this.userService.createAuditLog(
      originUser.id,
      transaction.id,
      AuditOperation.DEBIT,
      -transaction.amount,
      originPreviousBalance,
      originNewBalance,
      `Payment sent to ${destinationUser.name}`,
      queryRunner,
    );

    await this.userService.createAuditLog(
      destinationUser.id,
      transaction.id,
      AuditOperation.CREDIT,
      transaction.amount,
      destinationPreviousBalance,
      destinationNewBalance,
      `Payment received from ${originUser.name}`,
      queryRunner,
    );
  }

  private async lockUsersSafely(
    originUserId: string,
    destinationUserId: string,
    queryRunner: any,
  ): Promise<{ origin: User; destination: User }> {
    // Always lock in alphabetical UUID order to prevent deadlocks
    const [firstUserId, secondUserId] = [originUserId, destinationUserId].sort();
    
    const firstUser = await this.userService.findByIdWithLock(firstUserId, queryRunner);
    const secondUser = await this.userService.findByIdWithLock(secondUserId, queryRunner);
    
    // Return users in original parameter order
    return {
      origin: originUserId === firstUserId ? firstUser : secondUser,
      destination: destinationUserId === firstUserId ? firstUser : secondUser,
    };
  }

  private async validatePendingTransaction(transactionId: string, queryRunner: any): Promise<Transaction> {
    const transaction = await queryRunner.manager
      .createQueryBuilder(Transaction, 'transaction')
      .setLock('pessimistic_write')
      .where('transaction.id = :id', { id: transactionId })
      .getOne();

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${transactionId} not found`);
    }

    if (transaction.state !== TransactionState.PENDING) {
      throw new BadRequestException('Transaction is not in pending state');
    }

    return transaction;
  }

  private async getPendingOutgoingAmount(userId: string, queryRunner: any): Promise<number> {
    const result = await queryRunner.manager
      .createQueryBuilder(Transaction, 'transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.originUserId = :userId', { userId })
      .andWhere('transaction.state = :state', { state: TransactionState.PENDING })
      .getRawOne();

    return parseFloat(result.total) || 0;
  }

  private generateTransactionHash(originUserId: string, destinationUserId: string, amount: number): string {
    const data = `${originUserId}:${destinationUserId}:${amount}`;
    return createHash('sha256').update(data).digest('hex');
  }

  private async checkDuplicateTransaction(
    originUserId: string,
    destinationUserId: string,
    amount: number,
  ): Promise<void> {
    const hash = this.generateTransactionHash(originUserId, destinationUserId, amount);
    const dedupKey = `tx-dedup:${hash}`;

    const exists = await this.redisService.exists(dedupKey);
    if (exists) {
      throw new BadRequestException(
        `Duplicate transaction detected. Please wait ${DEDUP_TTL_MINUTES} minutes before retrying the same transaction.`,
      );
    }

    // Store the hash to prevent duplicates
    const ttlSeconds = DEDUP_TTL_MINUTES * 60;
    await this.redisService.set(dedupKey, 'duplicate-check', ttlSeconds);
  }
}