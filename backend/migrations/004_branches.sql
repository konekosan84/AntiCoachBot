CREATE TABLE slotiq.branches (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL,
    name VARCHAR(120) NOT NULL,
    address TEXT,
    phone VARCHAR(40),
    opening_time TIME,
    closing_time TIME,
    created_at TIMESTAMP DEFAULT NOW()
);
