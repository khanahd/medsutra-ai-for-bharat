import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('flagged_statements')
export class FlaggedStatement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  statement: string;

  @Column({ type: 'varchar', length: 200 })
  reason: string;

  @Column({ type: 'varchar', length: 50 })
  module: string;

  @Column({ type: 'uuid', name: 'patient_id', nullable: true })
  patientId: string | null;

  @CreateDateColumn({ name: 'flagged_at' })
  flaggedAt: Date;

  @Column({ type: 'boolean', default: false })
  reviewed: boolean;

  @Column({ type: 'text', name: 'review_notes', nullable: true })
  reviewNotes: string | null;
}
