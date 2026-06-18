CREATE TABLE slotiq.schedule (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES slotiq.employees(id) ON DELETE CASCADE,
    branch_id INT REFERENCES slotiq.branches(id) ON DELETE CASCADE,
    room_id INT REFERENCES slotiq.rooms(id),
    day DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
