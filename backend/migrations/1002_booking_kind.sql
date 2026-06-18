-- Distinguishes regular customer bookings from internal "blocks" (cleaning, repair, etc.)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'booking';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_kind_chk'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_kind_chk CHECK (kind IN ('booking','block'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_bookings_kind ON public.bookings(kind);
