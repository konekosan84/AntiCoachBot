-- Photo/avatar URLs for entities
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.branches  ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.rooms     ADD COLUMN IF NOT EXISTS photo_url TEXT;
