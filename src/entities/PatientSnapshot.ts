import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Patient } from './Patient';

@Entity('patient_snapshots')
export class PatientSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'jsonb', name: 'snapshot_data' })
  snapshotData: {
    keyComplaints: string[];
    pastMedicalHistory: string[];
    currentMedications: any[];
    abnormalFindings: any[];
    pendingActions: any[];
  };

  @Column({ type: 'uuid', array: true, name: 'source_documents' })
  sourceDocuments: string[];

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;

  @Column({ type: 'varchar', length: 50, name: 'generated_by' })
  generatedBy: string;
}
