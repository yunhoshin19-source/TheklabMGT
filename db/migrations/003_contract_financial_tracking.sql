-- 003 Contract financial separation, installment allocations and immutable revisions
-- Apply after 001_schema.sql and 002_contract_master.sql inside a transaction.
BEGIN;
-- Remove original type-dependent checks so maintenance may hold distinct lifetime and monthly amounts.
DO $$
DECLARE c record;
BEGIN
 FOR c IN SELECT conname FROM pg_constraint
 WHERE conrelid='contracts'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%monthly_amount%'
 AND pg_get_constraintdef(oid) LIKE '%total_amount%'
 LOOP EXECUTE format('ALTER TABLE contracts DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
-- Preserve previously stored amount in the lifetime contract amount field if available.
UPDATE contracts SET total_amount=monthly_amount WHERE type='maintenance' AND total_amount IS NULL;
ALTER TABLE contracts ADD CONSTRAINT ck_financial_amounts_003 CHECK (
 (type='maintenance' AND monthly_amount IS NOT NULL AND monthly_amount>=0 AND total_amount IS NOT NULL AND total_amount>=0 AND billing_day BETWEEN 1 AND 31)
 OR (type='project' AND total_amount IS NOT NULL AND total_amount>=0)
);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE contracts ADD CONSTRAINT ck_revision_positive_003 CHECK (revision>=1);
ALTER TABLE contract_schedules ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- Link actual receipt vouchers to installment schedules. Multiple receipts per installment are allowed.
CREATE TABLE IF NOT EXISTS schedule_receipt_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 schedule_id uuid NOT NULL REFERENCES contract_schedules(id) ON DELETE RESTRICT,
 receipt_voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
 amount numeric(16,2) NOT NULL CHECK(amount>0),
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(schedule_id,receipt_voucher_id)
);
CREATE INDEX IF NOT EXISTS idx_schedule_allocations_schedule ON schedule_receipt_allocations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_allocations_receipt ON schedule_receipt_allocations(receipt_voucher_id);
-- Prevent direct changes to past change history records.
CREATE OR REPLACE FUNCTION contract_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Contract history is append-only'; END $$;
DROP TRIGGER IF EXISTS trg_contract_history_immutable ON contract_change_history;
CREATE TRIGGER trg_contract_history_immutable BEFORE UPDATE OR DELETE ON contract_change_history
 FOR EACH ROW EXECUTE FUNCTION contract_history_immutable();
COMMIT;
