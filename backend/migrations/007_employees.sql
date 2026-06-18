CREATE TABLE slotiq.employees (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(40),
    email VARCHAR(120),
    avatar TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- связь "где работает сотрудник"
CREATE TABLE slotiq.employee_branches (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES slotiq.employees(id) ON DELETE CASCADE,
    branch_id INT REFERENCES slotiq.branches(id) ON DELETE CASCADE
);
