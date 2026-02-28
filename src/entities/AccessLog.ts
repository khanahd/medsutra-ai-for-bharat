import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('access_logs')
export class AccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 100, name: 'user_name' })
  userName: string;

  @Column({ type: 'varchar', length: 50 })
  role: string;

  @Column({ type: 'varchar', length: 200 })
  resource: string;

  @Column({ type: 'varchar', length: 20 })
  action: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT';

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'inet', name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'boolean' })
  success: boolean;
}
