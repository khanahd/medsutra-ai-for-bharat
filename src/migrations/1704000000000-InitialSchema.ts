import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create patients table
    await queryRunner.query(`
      CREATE TABLE patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        medical_record_number VARCHAR(50) UNIQUE NOT NULL,
        encrypted_phi BYTEA NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_patients_mrn ON patients(medical_record_number);
    `);

    // Create clinical_documents table
    await queryRunner.query(`
      CREATE TABLE clinical_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        author_id UUID NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        metadata JSONB
      );
      CREATE INDEX idx_clinical_documents_patient ON clinical_documents(patient_id);
      CREATE INDEX idx_clinical_documents_type ON clinical_documents(document_type);
    `);

    // Create patient_snapshots table
    await queryRunner.query(`
      CREATE TABLE patient_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        snapshot_data JSONB NOT NULL,
        source_documents UUID[] NOT NULL,
        generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        generated_by VARCHAR(50) NOT NULL
      );
      CREATE INDEX idx_patient_snapshots_patient ON patient_snapshots(patient_id);
    `);

    // Create radiology_analyses table
    await queryRunner.query(`
      CREATE TABLE radiology_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        report_id UUID NOT NULL,
        cancer_risk_flag VARCHAR(10) NOT NULL CHECK (cancer_risk_flag IN ('LOW', 'MEDIUM', 'HIGH')),
        suspicious_terms JSONB NOT NULL,
        explanation TEXT NOT NULL,
        analyzed_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_radiology_analyses_patient ON radiology_analyses(patient_id);
      CREATE INDEX idx_radiology_analyses_risk ON radiology_analyses(cancer_risk_flag);
    `);

    // Create document_drafts table
    await queryRunner.query(`
      CREATE TABLE document_drafts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED')),
        created_by UUID NOT NULL,
        approved_by UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMP
      );
      CREATE INDEX idx_document_drafts_patient ON document_drafts(patient_id);
      CREATE INDEX idx_document_drafts_status ON document_drafts(status);
    `);

    // Create workflow_suggestions table
    await queryRunner.query(`
      CREATE TABLE workflow_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        suggestion_type VARCHAR(50) NOT NULL,
        priority VARCHAR(10) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
        reasoning TEXT NOT NULL,
        evidence JSONB NOT NULL,
        clinician_action VARCHAR(20) CHECK (clinician_action IN ('ACCEPT', 'MODIFY', 'REJECT')),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        responded_at TIMESTAMP
      );
      CREATE INDEX idx_workflow_suggestions_patient ON workflow_suggestions(patient_id);
      CREATE INDEX idx_workflow_suggestions_priority ON workflow_suggestions(priority);
    `);

    // Create access_logs table
    await queryRunner.query(`
      CREATE TABLE access_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        resource VARCHAR(200) NOT NULL,
        action VARCHAR(20) NOT NULL CHECK (action IN ('READ', 'WRITE', 'DELETE', 'EXPORT')),
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        ip_address INET NOT NULL,
        success BOOLEAN NOT NULL
      );
      CREATE INDEX idx_access_logs_user ON access_logs(user_id);
      CREATE INDEX idx_access_logs_timestamp ON access_logs(timestamp);
    `);

    // Create audit_records table with 7-year retention
    await queryRunner.query(`
      CREATE TABLE audit_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(50) NOT NULL,
        user_id UUID NOT NULL,
        patient_id UUID,
        ai_suggestion TEXT,
        clinician_response VARCHAR(20) CHECK (clinician_response IN ('ACCEPTED', 'MODIFIED', 'REJECTED')),
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        metadata JSONB,
        CONSTRAINT audit_retention CHECK (timestamp > NOW() - INTERVAL '7 years')
      );
      CREATE INDEX idx_audit_records_user ON audit_records(user_id);
      CREATE INDEX idx_audit_records_patient ON audit_records(patient_id);
      CREATE INDEX idx_audit_records_timestamp ON audit_records(timestamp);
    `);

    // Create flagged_statements table
    await queryRunner.query(`
      CREATE TABLE flagged_statements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        statement TEXT NOT NULL,
        reason VARCHAR(200) NOT NULL,
        module VARCHAR(50) NOT NULL,
        patient_id UUID,
        flagged_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reviewed BOOLEAN DEFAULT FALSE,
        review_notes TEXT
      );
      CREATE INDEX idx_flagged_statements_reviewed ON flagged_statements(reviewed);
      CREATE INDEX idx_flagged_statements_module ON flagged_statements(module);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS flagged_statements CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_records CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS access_logs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS workflow_suggestions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS document_drafts CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS radiology_analyses CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS patient_snapshots CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS clinical_documents CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS patients CASCADE;`);
  }
}
