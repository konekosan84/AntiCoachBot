CREATE TABLE slotiq.bookings (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL,
    branch_id INT REFERENCES slotiq.branches(id),
    room_id INT REFERENCES slotiq.rooms(id),
    employee_id INT REFERENCES slotiq.employees(id),
    service_id INT REFERENCES slotiq.services(id),
    client_id INT REFERENCES slotiq.clients(id),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
