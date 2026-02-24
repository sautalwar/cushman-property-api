-- PropTracker APIM POC — Database Schema
-- Run: psql -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS contractors CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role        VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'property_owner', 'contractor')),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE properties (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  address       VARCHAR(255) NOT NULL,
  city          VARCHAR(100) NOT NULL,
  state         VARCHAR(50) NOT NULL,
  zip_code      VARCHAR(20) NOT NULL,
  property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('commercial_office', 'commercial_retail', 'commercial_industrial', 'residential')),
  square_feet   INTEGER NOT NULL,
  monthly_rent  DECIMAL(12,2) NOT NULL,
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contractors (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  specialty    VARCHAR(50) NOT NULL CHECK (specialty IN ('plumbing', 'electrical', 'roofing')),
  hourly_rate  DECIMAL(8,2) NOT NULL,
  is_verified  BOOLEAN DEFAULT FALSE,
  rating       DECIMAL(3,2) DEFAULT 0.00,
  webhook_url  TEXT,
  -- VULN-3: role column here intentionally so mass assignment can change it
  role         VARCHAR(50) DEFAULT 'contractor',
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE jobs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                 VARCHAR(255) NOT NULL,
  description           TEXT NOT NULL,
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id              UUID NOT NULL REFERENCES users(id),
  assigned_contractor_id UUID REFERENCES contractors(id),
  required_specialty    VARCHAR(50) NOT NULL CHECK (required_specialty IN ('plumbing', 'electrical', 'roofing')),
  status                VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'disputed')),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bids (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  amount        DECIMAL(12,2) NOT NULL,
  note          TEXT,
  submitted_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, contractor_id)
);

-- Indexes
CREATE INDEX idx_properties_owner ON properties(owner_id);
CREATE INDEX idx_jobs_owner ON jobs(owner_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_bids_job ON bids(job_id);
CREATE INDEX idx_contractors_specialty ON contractors(specialty);