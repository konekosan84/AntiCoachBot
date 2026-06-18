CREATE TABLE slotiq.clients (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(40),
    email VARCHAR(120),
    created_at TIMESTAMP DEFAULT NOW()
);
