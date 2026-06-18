CREATE TABLE slotiq.analytics_daily (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL,
    date DATE NOT NULL,
    total_bookings INT DEFAULT 0,
    total_revenue NUMERIC(10,2) DEFAULT 0,
    top_service VARCHAR(120),
    top_employee VARCHAR(120),
    created_at TIMESTAMP DEFAULT NOW()
);
