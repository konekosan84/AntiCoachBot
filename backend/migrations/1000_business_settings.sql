-- ============================================================
-- SLOTIQ PRO — Business settings (booking type, etc.)
-- One row per business. business_id=1 = default tenant.
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.business_settings (
  business_id   INT PRIMARY KEY,
  booking_type  VARCHAR(20) NOT NULL DEFAULT 'service'
                 CHECK (booking_type IN ('service','room')),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Seed default row for business_id=1
INSERT INTO public.business_settings (business_id, booking_type)
VALUES (1, 'service')
ON CONFLICT (business_id) DO NOTHING;
