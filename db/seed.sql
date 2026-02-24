-- PropTracker APIM POC — Seed Data
-- Run AFTER schema.sql

-- Users (passwords are all "Password123!" hashed with bcrypt cost 12)
INSERT INTO users (id, email, password_hash, role) VALUES
  ('11111111-0000-0000-0000-000000000001', 'admin@proptracker.com',    '$2a$12$F9q5MwOQeVeBi9OdQzpqD.pzeUieaOY7ul4AzlnXcieAuIY4S8Xbm', 'admin'),
  ('22222222-0000-0000-0000-000000000001', 'alice@propowner.com',      '$2a$12$F9q5MwOQeVeBi9OdQzpqD.pzeUieaOY7ul4AzlnXcieAuIY4S8Xbm', 'property_owner'),
  ('22222222-0000-0000-0000-000000000002', 'bob@propowner.com',        '$2a$12$F9q5MwOQeVeBi9OdQzpqD.pzeUieaOY7ul4AzlnXcieAuIY4S8Xbm', 'property_owner'),
  ('33333333-0000-0000-0000-000000000001', 'charlie@plumbing.com',     '$2a$12$F9q5MwOQeVeBi9OdQzpqD.pzeUieaOY7ul4AzlnXcieAuIY4S8Xbm', 'contractor'),
  ('33333333-0000-0000-0000-000000000002', 'diana@electric.com',       '$2a$12$F9q5MwOQeVeBi9OdQzpqD.pzeUieaOY7ul4AzlnXcieAuIY4S8Xbm', 'contractor'),
  ('33333333-0000-0000-0000-000000000003', 'evan@roofing.com',         '$2a$12$F9q5MwOQeVeBi9OdQzpqD.pzeUieaOY7ul4AzlnXcieAuIY4S8Xbm', 'contractor');

-- Properties
INSERT INTO properties (id, name, address, city, state, zip_code, property_type, square_feet, monthly_rent, owner_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Westfield Tower',      '100 Main St',    'Chicago',    'IL', '60601', 'commercial_office',      45000, 85000.00, '22222222-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Lakefront Retail Hub', '200 Lake Shore', 'Chicago',    'IL', '60611', 'commercial_retail',       12000, 32000.00, '22222222-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Northside Warehouse',  '500 Industrial', 'Chicago',    'IL', '60640', 'commercial_industrial',   80000, 45000.00, '22222222-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Park Residences',      '1000 Park Ave',  'New York',   'NY', '10001', 'residential',             25000, 120000.00,'22222222-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Harbor Office Center', '300 Harbor Dr',  'Seattle',    'WA', '98101', 'commercial_office',       38000, 72000.00, '22222222-0000-0000-0000-000000000002');

-- Contractors
INSERT INTO contractors (id, user_id, company_name, specialty, hourly_rate, is_verified, rating) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Charlie Pro Plumbing',    'plumbing',   95.00,  true,  4.8),
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', 'Diana Electric Co.',      'electrical', 110.00, true,  4.9),
  ('bbbbbbbb-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000003', 'Evan Roofing Solutions',  'roofing',    85.00,  true,  4.6),
  ('bbbbbbbb-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000001', 'Budget Plumbers LLC',     'plumbing',   70.00,  false, 3.2),
  ('bbbbbbbb-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000002', 'FastFix Electrical',      'electrical', 90.00,  false, 3.8);

-- Jobs
INSERT INTO jobs (id, title, description, property_id, owner_id, required_specialty, status) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'Fix lobby plumbing leak',    'Main lobby bathroom has a persistent leak under the sink.',                   'aaaaaaaa-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'plumbing',   'open'),
  ('cccccccc-0000-0000-0000-000000000002', 'Rewire 3rd floor electrical', 'Outdated wiring on 3rd floor needs full replacement to meet code.',           'aaaaaaaa-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'electrical', 'assigned'),
  ('cccccccc-0000-0000-0000-000000000003', 'Roof repair after storm',    'Several shingles damaged after last storm. Needs inspection and repair.',      'aaaaaaaa-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'roofing',    'open'),
  ('cccccccc-0000-0000-0000-000000000004', 'Install new HVAC wiring',    'New HVAC system requires dedicated electrical circuit installation.',          'aaaaaaaa-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 'electrical', 'open'),
  ('cccccccc-0000-0000-0000-000000000005', 'Residential plumbing upgrade','Replace aging galvanized pipes throughout the building.',                     'aaaaaaaa-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000002', 'plumbing',   'open'),
  ('cccccccc-0000-0000-0000-000000000006', 'Commercial roof waterproofing','Apply waterproofing membrane to flat roof before rainy season.',             'aaaaaaaa-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000002', 'roofing',    'in_progress'),
  ('cccccccc-0000-0000-0000-000000000007', 'Emergency pipe burst repair', 'Pipe burst in basement — urgent fix needed.',                                 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'plumbing',   'completed'),
  ('cccccccc-0000-0000-0000-000000000008', 'Office lighting upgrade',    'Replace fluorescent fixtures with LED throughout 4 floors.',                   'aaaaaaaa-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'electrical', 'open'),
  ('cccccccc-0000-0000-0000-000000000009', 'Parking garage roof repair', 'Concrete spalling on parking garage roof level 3.',                           'aaaaaaaa-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 'roofing',    'open'),
  ('cccccccc-0000-0000-0000-000000000010', 'Sprinkler system inspection', 'Annual fire sprinkler system test and certification.',                        'aaaaaaaa-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'plumbing',   'open');

-- Assign contractor to job 2
UPDATE jobs SET assigned_contractor_id = 'bbbbbbbb-0000-0000-0000-000000000002' WHERE id = 'cccccccc-0000-0000-0000-000000000002';
UPDATE jobs SET assigned_contractor_id = 'bbbbbbbb-0000-0000-0000-000000000003' WHERE id = 'cccccccc-0000-0000-0000-000000000006';

-- Bids
INSERT INTO bids (job_id, contractor_id, amount, note) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 850.00,  'Can start Monday, estimate 1 day work'),
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', 620.00,  'Cheapest quote, available immediately'),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 2400.00, 'Full roof inspection + repair, 2-day job'),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 1800.00, 'Dedicated 20A circuit, permit included'),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000005', 1500.00, 'Same quality, lower price');