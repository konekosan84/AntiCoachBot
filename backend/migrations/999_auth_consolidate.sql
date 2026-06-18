-- ============================================================
-- SLOTIQ PRO — Auth consolidation migration
-- Unifies users + roles tables into a single canonical shape.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1. roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO public.roles (name) VALUES
  ('owner'),
  ('admin'),
  ('employee')
ON CONFLICT (name) DO NOTHING;

-- 2. users table — create if missing
CREATE TABLE IF NOT EXISTS public.users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id       INT REFERENCES public.roles(id) DEFAULT 1,
  business_id   INT,
  name          VARCHAR(120),
  phone         VARCHAR(40),
  status        VARCHAR(20) DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 3. Backfill missing columns (for existing installs)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_id       INT REFERENCES public.roles(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS business_id   INT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name          VARCHAR(120);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone         VARCHAR(40);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status        VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at    TIMESTAMP DEFAULT NOW();

-- 4. Migrate old `password` column → `password_hash` if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='password'
  ) THEN
    UPDATE public.users
      SET password_hash = password
      WHERE (password_hash IS NULL OR password_hash = '')
        AND password IS NOT NULL;
    ALTER TABLE public.users DROP COLUMN password;
  END IF;
END$$;

-- 5. Migrate old text `role` column → `role_id`
DO $$
DECLARE
  v_owner_id INT;
BEGIN
  SELECT id INTO v_owner_id FROM public.roles WHERE name='owner';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='role'
      AND data_type IN ('character varying','text')
  ) THEN
    UPDATE public.users u
       SET role_id = r.id
      FROM public.roles r
     WHERE LOWER(u.role) = r.name
       AND u.role_id IS NULL;

    UPDATE public.users SET role_id = v_owner_id WHERE role_id IS NULL;

    ALTER TABLE public.users DROP COLUMN role;
  END IF;
END$$;

-- 6. Ensure NOT NULL on critical columns where possible
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE password_hash IS NULL
  ) THEN
    ALTER TABLE public.users ALTER COLUMN password_hash SET NOT NULL;
  END IF;
END$$;

UPDATE public.users
   SET role_id = (SELECT id FROM public.roles WHERE name='owner')
 WHERE role_id IS NULL;

-- 7. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email   ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role    ON public.users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_business ON public.users (business_id);

-- 8. Seed default owner if no users exist (password: admin123)
INSERT INTO public.users (email, password_hash, role_id, name, status)
SELECT
  'owner@slotiq.pro',
  '$2b$10$qpR5EkbzDIRaEnpGxWX/4efhtyYWTwaVVZQIIBPsbfzd1Mvxh08GO',
  (SELECT id FROM public.roles WHERE name='owner'),
  'Платформа Owner',
  'active'
WHERE NOT EXISTS (SELECT 1 FROM public.users);
