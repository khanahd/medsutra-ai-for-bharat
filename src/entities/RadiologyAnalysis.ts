import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Patient } from './Patient';

@Entity('radiology_analyses')
export class RadiologyAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', name: 'report_id' })
  reportId: string;

  @Column({ type: 'varchar', length: 10, name: 'cancer_risk_flag' })
  cancerRiskFlag: 'LOW' | 'MEDIUM' | 'HIGH';

  @Column({ type: 'jsonb', name: 'suspicious_terms' })
  suspiciousTerms: any[];

  @Column({ type: 'text' })
  explanation: string;

  @CreateDateColumn({ name: 'analyzed_at' })
  analyzedAt: Date;
}
