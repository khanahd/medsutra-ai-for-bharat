import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Patient } from './Patient';

@Entity('workflow_suggestions')
export class WorkflowSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'varchar', length: 50, name: 'suggestion_type' })
  suggestionType: 'ONCOLOGY_REFERRAL' | 'BIOPSY' | 'FOLLOW_UP_IMAGING' | 'LAB_TEST';

  @Column({ type: 'varchar', length: 10 })
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @Column({ type: 'text' })
  reasoning: string;

  @Column({ type: 'jsonb' })
  evidence: any[];

  @Column({ type: 'varchar', length: 20, name: 'clinician_action', nullable: true })
  clinicianAction: 'ACCEPT' | 'MODIFY' | 'REJECT' | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'responded_at', nullable: true })
  respondedAt: Date | null;
}
