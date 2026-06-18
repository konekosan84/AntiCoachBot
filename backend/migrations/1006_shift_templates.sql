-- Шаблоны смен: "Иванова работает Пн-Пт 10-19 в филиале X"
-- Один шаблон = один день недели + один сотрудник + один филиал + время.
-- На вкладке "Расписание" одной кнопкой генерируем реальные смены на N недель вперёд.

CREATE TABLE IF NOT EXISTS public.shift_templates (
  id           SERIAL PRIMARY KEY,
  employee_id  INT NOT NULL,
  branch_id    INT NOT NULL,
  weekday      SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Mon..6=Sun (ISO)
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_templates_employee ON public.shift_templates(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_templates_branch   ON public.shift_templates(branch_id);
