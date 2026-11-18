-- THE KLAB MGT contract/party master expansion (run after 001_schema.sql)
-- This migration adds separate person/business counterparties while retaining legacy organizations.
CREATE TABLE IF NOT EXISTS counterparties (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 party_type text NOT NULL CHECK (party_type IN ('business','individual')),
 display_name text NOT NULL,
 registration_number text,
 business_category text,
 vat_treatment text NOT NULL DEFAULT 'unknown' CHECK(vat_treatment IN ('unknown','taxable','exempt','not_applicable')),
 contact_email text,
 contact_phone text,
 address text,
 notes text,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((party_type='business') OR (registration_number IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_counterparty_business_registration
 ON counterparties(registration_number) WHERE party_type='business' AND registration_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_counterparty_name ON counterparties(display_name);
CREATE TABLE IF NOT EXISTS counterparty_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 counterparty_id uuid NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
 full_name text NOT NULL,
 title text,
 email text,
 phone text,
 is_primary boolean NOT NULL DEFAULT false,
 notes text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_counterparty_primary_contact
 ON counterparty_contacts(counterparty_id) WHERE is_primary;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS counterparty_id uuid REFERENCES counterparties(id);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_on date;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS vat_treatment text NOT NULL DEFAULT 'taxable';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS vat_amount numeric(16,2) NOT NULL DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_notice_days integer NOT NULL DEFAULT 30;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS internal_owner_id uuid;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES counterparty_contacts(id);
ALTER TABLE contracts ADD CONSTRAINT ck_contract_status_002 CHECK (status IN ('draft','review','active','completed','terminated','cancelled'));
ALTER TABLE contracts ADD CONSTRAINT ck_contract_vat_002 CHECK (vat_treatment IN ('taxable','exempt','not_applicable'));
ALTER TABLE contracts ADD CONSTRAINT ck_contract_renewal_days_002 CHECK (renewal_notice_days>=0);
CREATE TABLE IF NOT EXISTS contract_schedules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
 schedule_type text NOT NULL CHECK(schedule_type IN ('billing','receipt','milestone','reminder')),
 title text NOT NULL,
 scheduled_on date NOT NULL,
 amount numeric(16,2) CHECK(amount>=0),
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','invoiced','partial','paid','overdue','cancelled')),
 voucher_id uuid REFERENCES vouchers(id),
 memo text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_schedules_date ON contract_schedules(scheduled_on);
CREATE INDEX IF NOT EXISTS idx_contract_schedules_contract ON contract_schedules(contract_id);
CREATE TABLE IF NOT EXISTS contract_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
 version_no integer NOT NULL DEFAULT 1 CHECK(version_no>0),
 file_category text NOT NULL DEFAULT 'signed_contract' CHECK(file_category IN ('draft','signed_contract','amendment','other')),
 original_filename text NOT NULL,
 storage_key text NOT NULL UNIQUE,
 content_type text NOT NULL,
 byte_size bigint NOT NULL CHECK(byte_size>0),
 checksum_sha256 text,
 uploaded_by uuid,
 uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_files_contract ON contract_files(contract_id);
CREATE TABLE IF NOT EXISTS contract_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
 content text NOT NULL,
 author_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contract_change_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 contract_id uuid NOT NULL REFERENCES contracts(id),
 changed_by uuid,
 change_type text NOT NULL,
 old_data jsonb,
 new_data jsonb,
 changed_at timestamptz NOT NULL DEFAULT now()
);
-- Note: For new data, set counterparty_id and use it as the canonical party reference.
-- Existing contracts with organization_id remain supported until a controlled migration.
-- Uploaded file bytes belong in a private storage service, never inside Git.
