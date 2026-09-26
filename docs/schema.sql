-- Traveler API database schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Travel plans
CREATE TABLE travel_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(200) NOT NULL,
    description TEXT,

    start_date DATE,
    end_date DATE,

    budget DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',

    is_public BOOLEAN DEFAULT FALSE,

    version INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT check_title_not_blank
        CHECK (LENGTH(TRIM(title)) > 0),

    CONSTRAINT check_travel_plan_dates
        CHECK (
            end_date IS NULL
            OR start_date IS NULL
            OR end_date >= start_date
        ),

    CONSTRAINT check_travel_plan_budget
        CHECK (
            budget IS NULL
            OR budget >= 0
        ),

    CONSTRAINT check_currency_length
        CHECK (LENGTH(currency) = 3),

    CONSTRAINT check_travel_plan_version
        CHECK (version > 0)
);

-- Locations
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    travel_plan_id UUID NOT NULL
        REFERENCES travel_plans(id)
        ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,
    address TEXT,

    latitude DECIMAL(10, 6),
    longitude DECIMAL(11, 6),

    visit_order INTEGER,

    arrival_date TIMESTAMPTZ,
    departure_date TIMESTAMPTZ,

    budget DECIMAL(10, 2),
    notes TEXT,

    version INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT check_location_name_not_blank
        CHECK (LENGTH(TRIM(name)) > 0),

    CONSTRAINT check_coordinates_lat
        CHECK (
            latitude IS NULL
            OR latitude BETWEEN -90 AND 90
        ),

    CONSTRAINT check_coordinates_lng
        CHECK (
            longitude IS NULL
            OR longitude BETWEEN -180 AND 180
        ),

    CONSTRAINT check_location_dates
        CHECK (
            departure_date IS NULL
            OR arrival_date IS NULL
            OR departure_date >= arrival_date
        ),

    CONSTRAINT check_location_budget
        CHECK (
            budget IS NULL
            OR budget >= 0
        ),

    CONSTRAINT check_location_version
        CHECK (version > 0),

    CONSTRAINT unique_plan_order
        UNIQUE (travel_plan_id, visit_order)
);

-- Automatically update travel_plans.updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_travel_plans_updated_at
BEFORE UPDATE ON travel_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Automatically assign visit_order to locations
CREATE OR REPLACE FUNCTION assign_location_order()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.visit_order IS NULL THEN
        SELECT COALESCE(MAX(visit_order), 0) + 1
        INTO NEW.visit_order
        FROM locations
        WHERE travel_plan_id = NEW.travel_plan_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_assign_location_order
BEFORE INSERT ON locations
FOR EACH ROW
EXECUTE FUNCTION assign_location_order();

-- Indexes
CREATE INDEX idx_travel_plans_dates
ON travel_plans(start_date, end_date)
WHERE start_date IS NOT NULL;

CREATE INDEX idx_travel_plans_public
ON travel_plans(is_public, updated_at DESC)
WHERE is_public = TRUE;

CREATE INDEX idx_travel_plans_updated
ON travel_plans(updated_at DESC);

CREATE INDEX idx_locations_plan_order
ON locations(travel_plan_id, visit_order);

CREATE INDEX idx_locations_coordinates
ON locations(latitude, longitude)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL;