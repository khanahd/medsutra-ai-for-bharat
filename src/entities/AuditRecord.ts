import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Check } from 'typeorm';

@Entity('audit_records')
@Check(`"timestamp" > NOW() - INTERVAL '7 years'`)
export class AuditRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'event_type' })
  eventType: 'AI_SUGGESTION' | 'CLINICIAN_DECISION' | 'DOCUMENT_APPROVAL' | 'DATA_ACCESS';

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'patient_id', nullable: true })
  patientId: string | null;

  @Column({ type: 'text', name: 'ai_suggestion', nullable: true })
  aiSuggestion: string | null;

  @Column({ type: 'varchar', length: 20, name: 'clinician_response', nullable: true })
  clinicianResponse: 'ACCEPTED' | 'MODIFIED' | 'REJECTED' | null;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
