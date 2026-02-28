import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Patient } from './Patient';

@Entity('document_drafts')
export class DocumentDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'varchar', length: 50, name: 'document_type' })
  documentType: 'OPD_NOTE' | 'DISCHARGE_SUMMARY' | 'REFERRAL_LETTER' | 'INSURANCE_DOC';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20 })
  status: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED';

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @Column({ type: 'uuid', name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'approved_at', nullable: true })
  approvedAt: Date | null;
}
