-- VSR Suite Inventory seed — 30 suites across 6 floors
-- Run in Supabase SQL editor to populate suite inventory for Venkateswara Suite Rooms, Tirupathi

INSERT INTO suites (suite_number, floor, status, price, notes)
VALUES
  -- Floor 1
  ('101', 1, 'Available', 2500, 'Standard Suite, Ground Floor'),
  ('102', 1, 'Available', 2500, 'Standard Suite, Garden View'),
  ('103', 1, 'Booked',    2500, 'Standard Suite'),
  ('104', 1, 'Available', 3000, 'Deluxe Suite, Corner Unit'),
  ('105', 1, 'Available', 3000, 'Deluxe Suite'),
  -- Floor 2
  ('201', 2, 'Available', 2800, 'Standard Suite'),
  ('202', 2, 'Booked',    2800, 'Standard Suite'),
  ('203', 2, 'Available', 2800, 'Standard Suite'),
  ('204', 2, 'Available', 3200, 'Deluxe Suite'),
  ('205', 2, 'Blocked',   3200, 'Deluxe Suite — AC maintenance'),
  -- Floor 3
  ('301', 3, 'Available', 3000, 'Standard Suite'),
  ('302', 3, 'Available', 3000, 'Standard Suite'),
  ('303', 3, 'Booked',    3000, 'Standard Suite'),
  ('304', 3, 'Available', 3500, 'Deluxe Suite'),
  ('305', 3, 'Available', 3500, 'Deluxe Suite, Hill View'),
  -- Floor 4
  ('401', 4, 'Available', 3200, 'Standard Suite'),
  ('402', 4, 'Booked',    3200, 'Standard Suite'),
  ('403', 4, 'Available', 3200, 'Standard Suite'),
  ('404', 4, 'Available', 3800, 'Premium Suite'),
  ('405', 4, 'Available', 3800, 'Premium Suite, Temple View'),
  -- Floor 5
  ('501', 5, 'Available', 3500, 'Standard Suite'),
  ('502', 5, 'Available', 3500, 'Standard Suite'),
  ('503', 5, 'Booked',    3500, 'Standard Suite'),
  ('504', 5, 'Available', 4200, 'Premium Suite'),
  ('505', 5, 'Available', 4200, 'Premium Suite, Panoramic View'),
  -- Floor 6 (Top Floor — Executive)
  ('601', 6, 'Available', 5000, 'Executive Suite'),
  ('602', 6, 'Available', 5000, 'Executive Suite'),
  ('603', 6, 'Booked',    5500, 'Executive Suite, Temple View'),
  ('604', 6, 'Available', 6000, 'Presidential Suite'),
  ('605', 6, 'Available', 6000, 'Presidential Suite, Full Temple View')
ON CONFLICT DO NOTHING;
