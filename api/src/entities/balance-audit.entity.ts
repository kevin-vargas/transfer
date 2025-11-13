import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Transaction } from './transaction.entity';

export enum AuditOperation {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  INITIAL_BALANCE = 'INITIAL_BALANCE',
}

@Entity('balance_audit')
export class BalanceAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  transactionId!: string;

  @Column({ type: 'enum', enum: AuditOperation })
  operation!: AuditOperation;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  previousBalance!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  newBalance!: number;

  @Column({ type: 'text' })
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Transaction, { nullable: true })
  @JoinColumn({ name: 'transactionId' })
  transaction!: Transaction;
}