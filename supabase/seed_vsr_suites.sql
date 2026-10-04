-- VSR Suite Inventory seed — 30 suites across 6 floors
-- Run in Supabase SQL editor to populate suite inventory for Venkateswara Suite Rooms, Tirupathi

INSERT INTO suites (suite_number, floor, status, price, notes)
VALUES
  -- Floor 1
  ('101', 1, 'available', 2500, 'Standard Suite, Ground Floor'),
  ('102', 1, 'available', 2500, 'Standard Suite, Garden View'),
  ('103', 1, 'booked',    2500, 'Standard Suite'),
  ('104', 1, 'available', 3000, 'Deluxe Suite, Corner Unit'),
  ('105', 1, 'available', 3000, 'Deluxe Suite'),
  -- Floor 2
  ('201', 2, 'available', 2800, 'Standard Suite'),
  ('202', 2, 'booked',    2800, 'Standard Suite'),
  ('203', 2, 'available', 2800, 'Standard Suite'),
  ('204', 2, 'available', 3200, 'Deluxe Suite'),
  ('205', 2, 'maintenance', 3200, 'Deluxe Suite — AC maintenance'),
  -- Floor 3
  ('301', 3, 'available', 3000, 'Standard Suite'),
  ('302', 3, 'available', 3000, 'Standard Suite'),
  ('303', 3, 'booked',    3000, 'Standard Suite'),
  ('304', 3, 'available', 3500, 'Deluxe Suite'),
  ('305', 3, 'available', 3500, 'Deluxe Suite, Hill View'),
  -- Floor 4
  ('401', 4, 'available', 3200, 'Standard Suite'),
  ('402', 4, 'booked',    3200, 'Standard Suite'),
  ('403', 4, 'available', 3200, 'Standard Suite'),
  ('404', 4, 'available', 3800, 'Premium Suite'),
  ('405', 4, 'available', 3800, 'Premium Suite, Temple View'),
  -- Floor 5
  ('501', 5, 'available', 3500, 'Standard Suite'),
  ('502', 5, 'available', 3500, 'Standard Suite'),
  ('503', 5, 'booked',    3500, 'Standard Suite'),
  ('504', 5, 'available', 4200, 'Premium Suite'),
  ('505', 5, 'available', 4200, 'Premium Suite, Panoramic View'),
  -- Floor 6 (Top Floor — Executive)
  ('601', 6, 'available', 5000, 'Executive Suite'),
  ('602', 6, 'available', 5000, 'Executive Suite'),
  ('603', 6, 'booked',    5500, 'Executive Suite, Temple View'),
  ('604', 6, 'available', 6000, 'Presidential Suite'),
  ('605', 6, 'available', 6000, 'Presidential Suite, Full Temple View')
ON CONFLICT DO NOTHING;
