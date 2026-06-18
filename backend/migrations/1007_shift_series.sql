-- Series of recurring shifts. Each shift created via "repeat" UI shares a series_id.
ALTER TABLE public.schedule_shifts
  ADD COLUMN IF NOT EXISTS series_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_series
  ON public.schedule_shifts(series_id)
  WHERE series_id IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.shift_series_seq;
