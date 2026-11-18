-- THE KLAB MGT PostgreSQL initialization schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_registration_no text,
  contact_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  contract_no text NOT NULL UNIQUE,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('maintenance', 'project')),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  monthly_amount numeric(16,2),
  billing_day integer CHECK (billing_day BETWEEN 1 AND 31),
  total_amount numeric(16,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  CHECK ((type='maintenance' AND monthly_amount IS NOT NULL AND billing_day IS NOT NULL)
      OR (type='project' AND total_amount IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS project_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_on date NOT NULL,
  amount numeric(16,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','partial','paid','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id),
  organization_id uuid REFERENCES organizations(id),
  type text NOT NULL CHECK (type IN ('billing','receipt','expense','payment')),
  title text NOT NULL,
  document_date date NOT NULL,
  accounting_date date NOT NULL,
  due_date date,
  supply_amount numeric(16,2) NOT NULL DEFAULT 0 CHECK(supply_amount >= 0),
  vat_amount numeric(16,2) NOT NULL DEFAULT 0 CHECK(vat_amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','cancelled')),
  invoice_issued boolean NOT NULL DEFAULT false,
  invoice_issued_on date,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_voucher_id uuid NOT NULL REFERENCES vouchers(id),
  settlement_voucher_id uuid NOT NULL REFERENCES vouchers(id),
  amount numeric(16,2) NOT NULL CHECK(amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(source_voucher_id <> settlement_voucher_id)
);
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK(byte_size > 0),
  sha256 text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vouchers_accounting_date ON vouchers(accounting_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_document_date ON vouchers(document_date);
CREATE INDEX IF NOT EXISTS idx_installments_due_on ON project_installments(due_on);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts(starts_on,ends_on);
CREATE INDEX IF NOT EXISTS idx_attachments_voucher ON attachments(voucher_id);
