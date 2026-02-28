import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Patient } from './Patient';

@Entity('clinical_documents')
export class ClinicalDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'varchar', length: 50, name: 'document_type' })
  documentType: 'EMR_NOTE' | 'LAB_REPORT' | 'DISCHARGE_SUMMARY' | 'REFERRAL' | 'RADIOLOGY_TEXT';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
