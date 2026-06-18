-- Add room_id column to bookings (for room-mode businesses)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS room_id INT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes   TEXT;

-- Indexes for filtering by room
CREATE INDEX IF NOT EXISTS idx_bookings_room ON public.bookings(room_id);
