import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Check } from 'typeorm';
import { User } from './user.entity';

export enum TransactionState {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

@Entity('transactions')
@Check('amount > 0')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  originUserId!: string;

  @Column({ type: 'uuid' })
  destinationUserId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'enum', enum: TransactionState, default: TransactionState.PENDING })
  state!: TransactionState;

  @Column({ type: 'timestamp' })
  date!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'originUserId' })
  originUser!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'destinationUserId' })
  destinationUser!: User;
}