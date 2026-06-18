-- Many-to-many: услуга ↔ филиалы
-- Если для услуги нет ни одной записи → услуга доступна во ВСЕХ филиалах (default).
-- Если есть записи → только в указанных филиалах.

CREATE TABLE IF NOT EXISTS public.service_branches (
  service_id INT NOT NULL,
  branch_id  INT NOT NULL,
  PRIMARY KEY (service_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_service_branches_service ON public.service_branches(service_id);
CREATE INDEX IF NOT EXISTS idx_service_branches_branch  ON public.service_branches(branch_id);
