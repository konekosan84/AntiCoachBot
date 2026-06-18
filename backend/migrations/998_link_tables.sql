-- Ensure many-to-many link tables exist in public schema
CREATE TABLE IF NOT EXISTS public.branch_employees (
  branch_id   INT NOT NULL,
  employee_id INT NOT NULL,
  PRIMARY KEY (branch_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_employees_employee ON public.branch_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_branch_employees_branch   ON public.branch_employees(branch_id);
