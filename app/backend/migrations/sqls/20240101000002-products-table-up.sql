/* Replace with your SQL commands */

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    category VARCHAR(100),
    image VARCHAR(500),
    description TEXT,
    preview_img JSONB DEFAULT '[]',
    types JSONB DEFAULT '[]',
    reviews JSONB DEFAULT '[]',
    overall_rating NUMERIC(3, 1) DEFAULT 0,
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);
