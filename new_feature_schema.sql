-- This script sets up the new tables and data for the Admin Reporting and Analytics feature.

-- 1. Create table for ER Teams
CREATE TABLE er_teams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create table for Incident Types
CREATE TABLE incident_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create table for Barangays
CREATE TABLE barangays (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create the main table for internal (admin-generated) reports
CREATE TABLE internal_reports (
    id SERIAL PRIMARY KEY,
    original_report_id UUID REFERENCES emergency_reports(id) NULL, -- Link to original report if applicable
    incident_type_id INT NOT NULL REFERENCES incident_types(id),
    incident_date TIMESTAMPTZ NOT NULL,
    time_responded TIMESTAMPTZ,
    barangay_id INT NOT NULL REFERENCES barangays(id),
    er_team_id INT NOT NULL REFERENCES er_teams(id),
    persons_involved INT,
    number_of_responders INT,
    prepared_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Insert initial data into the new tables

-- ER Teams
INSERT INTO er_teams (name) VALUES
('Team Alpha'),
('Team Charlie'),
('Team Bravo');

-- Incident Types
INSERT INTO incident_types (name) VALUES
('Armed Conflict'),
('Medical Emergency'),
('Vehicular/Pedestrian Roadcrash Incident'),
('Drowning Incident'),
('Others'),
('Water Mishop'),
('Fire Incident'),
('Vehicular/Pedestrian Accident'),
('Weather Disturbance');

-- Barangays
INSERT INTO barangays (name) VALUES
('A. Bonifacio (Tinurilan)'),
('Abad Santos (Kambal)'),
('Aguinaldo (Lipata Dako)'),
('Antipolo'),
('Aquino (Imelda)'),
('Bical'),
('Beguin'),
('Bonga'),
('Butag'),
('Cadandanan'),
('Calomagon'),
('Calpi'),
('Cocok-Cabitan'),
('Daganas'),
('Danao'),
('Dolos'),
('E. Quirino (Pinangomhan)'),
('Fabrica'),
('G. Del Pilar (Tanga)'),
('Gate'),
('Inararan'),
('J. Gerona (Biton)'),
('J.P. Laurel (Pon-od)'),
('Jamorawon'),
('Libertad (Calle Putol)'),
('Lajong'),
('Magsaysay (Bongog)'),
('Managa-naga'),
('Marinab'),
('Nasuje'),
('Montecalvario'),
('N. Roque (Calayugan)'),
('Namo'),
('Obrero'),
('Osmeña (Lipata Saday)'),
('Otavi'),
('Padre Diaz'),
('Palale'),
('Quezon (Cabarawan)'),
('R. Gerona'),
('Recto'),
('Roxas (Busay)'),
('Sagrada'),
('San Francisco (Polot)'),
('San Isidro (Cabugaan)'),
('San Juan Bag-o'),
('San Juan Daan'),
('San Rafael (Togbongon)'),
('San Ramon'),
('San Vicente'),
('Sta. Remedios'),
('Sta. Teresita (Trece)'),
('Sigad'),
('Somagongsong'),
('Taromata'),
('Zone 1 (Ilawod)'),
('Zone 2 (Ilawod/Sabang)'),
('Zone 3 (Central)'),
('Zone 4 (Central)'),
('Zone 5 (Canipaan)'),
('Zone 6 (Baybay)'),
('Zone 7 (Iraya)'),
('Zone 8 (Loyo)');

-- 6. Enable RLS for the new tables (assuming you want to protect them)
ALTER TABLE er_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE barangays ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_reports ENABLE ROW LEVEL SECURITY;

-- 7. Create policies to allow admins to read/write these tables
-- (You might need to adjust the admin check to match your system)
CREATE POLICY "Allow admins full access to er_teams" ON er_teams FOR ALL USING (auth.jwt()->>'role' = 'admin') WITH CHECK (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Allow admins full access to incident_types" ON incident_types FOR ALL USING (auth.jwt()->>'role' = 'admin') WITH CHECK (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Allow admins full access to barangays" ON barangays FOR ALL USING (auth.jwt()->>'role' = 'admin') WITH CHECK (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Allow admins full access to internal_reports" ON internal_reports FOR ALL USING (auth.jwt()->>'role' = 'admin') WITH CHECK (auth.jwt()->>'role' = 'admin');

-- Note: If you have a different way of identifying admins (e.g., a custom function), replace `auth.jwt()->>'role' = 'admin'` with your method.

