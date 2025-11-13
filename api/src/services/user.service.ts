import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { BalanceAudit, AuditOperation } from '../entities/balance-audit.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(BalanceAudit)
    private auditRepository: Repository<BalanceAudit>,
  ) {}

  async createUser(name: string, email: string, initialBalance: number = 0): Promise<User> {
    const user = this.userRepository.create({
      name,
      email,
      balance: initialBalance,
    });

    const savedUser = await this.userRepository.save(user);

    if (initialBalance > 0) {
      await this.auditRepository.save({
        userId: savedUser.id,
        operation: AuditOperation.INITIAL_BALANCE,
        amount: initialBalance,
        previousBalance: 0,
        newBalance: initialBalance,
        description: `Initial balance set to ${initialBalance}`,
      });
    }

    return savedUser;
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByIdWithLock(id: string, queryRunner: any): Promise<User> {
    const user = await queryRunner.manager
      .createQueryBuilder(User, 'user')
      .setLock('pessimistic_write')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async updateBalance(user: User, newBalance: number, queryRunner: any): Promise<User> {
    const previousBalance = user.balance;
    user.balance = newBalance;
    return queryRunner.manager.save(user);
  }

  async createAuditLog(
    userId: string,
    transactionId: string | null,
    operation: AuditOperation,
    amount: number,
    previousBalance: number,
    newBalance: number,
    description: string,
    queryRunner: any,
  ): Promise<void> {
    const audit = queryRunner.manager.create(BalanceAudit, {
      userId,
      transactionId,
      operation,
      amount,
      previousBalance,
      newBalance,
      description,
    });
    await queryRunner.manager.save(audit);
  }
}