CREATE TABLE slotiq.employees_services (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES slotiq.employees(id) ON DELETE CASCADE,
    service_id INT REFERENCES slotiq.services(id) ON DELETE CASCADE
);
