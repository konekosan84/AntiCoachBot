CREATE TABLE slotiq.services (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL,
    name VARCHAR(120) NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    duration INT NOT NULL DEFAULT 30,  -- minutes
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
