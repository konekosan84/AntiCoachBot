CREATE TABLE slotiq.roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO slotiq.roles (name) VALUES
('owner'),
('admin'),
('employee');
