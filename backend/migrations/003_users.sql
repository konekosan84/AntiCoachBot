CREATE TABLE slotiq.users (
    id SERIAL PRIMARY KEY,
    role_id INT REFERENCES slotiq.roles(id),
    business_id INT,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    phone VARCHAR(40),
    password VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);
