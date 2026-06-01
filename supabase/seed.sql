-- =========================================================================
-- 5. COMPREHENSIVE SEED DATA (PRODUCTION SEED SCRIPT)
-- =========================================================================

-- A. SEED BRANCHES
INSERT INTO public.branches (id, name, address, phone)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Den Modify - Bangkok HQ', '123 Srinakarin Rd, Nong Bon, Prawet, Bangkok 10250', '+662-123-4567'),
    ('22222222-2222-2222-2222-222222222222', 'Den Modify - Pathum Thani Outpost', '88 Rangsit-Nakornnayok Rd, Thanyaburi, Pathum Thani 12110', '+662-987-6543')
ON CONFLICT (id) DO NOTHING;

-- B. SEED PROFILES
-- Note: Inserts directly into public.profiles only if they have a matching user account in auth.users.
-- User accounts must be created in Supabase Auth beforehand (see USER_SETUP.md for instructions and custom SQL helper).
INSERT INTO public.profiles (id, email, full_name, role, branch_id, is_active)
SELECT val.id, val.email, val.full_name, val.role, val.branch_id, val.is_active
FROM (VALUES
    ('00000000-0000-0000-0000-000000000001'::UUID, 'owner@denmodify.com', 'Kittisak Denowner', 'owner', NULL::UUID, true),
    ('00000000-0000-0000-0000-000000000011'::UUID, 'admin1@denmodify.com', 'Somchai Branchone', 'admin', '11111111-1111-1111-1111-111111111111'::UUID, true),
    ('00000000-0000-0000-0000-000000000021'::UUID, 'admin2@denmodify.com', 'Anong Branchtwo', 'admin', '22222222-2222-2222-2222-222222222222'::UUID, true),
    ('00000000-0000-0000-0000-000000000031'::UUID, 'tech1@denmodify.com', 'Prasert Wrapmaster', 'technician', '11111111-1111-1111-1111-111111111111'::UUID, true),
    ('00000000-0000-0000-0000-000000000032'::UUID, 'tech2@denmodify.com', 'Wichai Carbonfitter', 'technician', '11111111-1111-1111-1111-111111111111'::UUID, true),
    ('00000000-0000-0000-0000-000000000041'::UUID, 'tech3@denmodify.com', 'Nattapong Tuner', 'technician', '22222222-2222-2222-2222-222222222222'::UUID, true),
    ('00000000-0000-0000-0000-000000000042'::UUID, 'tech4@denmodify.com', 'Somsak Detailer', 'technician', '22222222-2222-2222-2222-222222222222'::UUID, true)
) AS val(id, email, full_name, role, branch_id, is_active)
JOIN auth.users u ON u.id = val.id
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    branch_id = EXCLUDED.branch_id,
    is_active = EXCLUDED.is_active;

-- C. SEED CUSTOMERS
INSERT INTO public.customers (id, branch_id, full_name, phone, email, line_user_id)
VALUES
    ('10000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Apinan Speedster', '+6681-555-0199', 'apinan@gmail.com', 'U1234567890abcdef1234567890abcdef'),
    ('10000000-0000-0000-0000-000000000021', '22222222-2222-2222-2222-222222222222', 'Chaiwat Drifter', '+6689-777-2244', 'chaiwat@hotmail.com', 'U0987654321fedcba0987654321fedcba')
ON CONFLICT (id) DO NOTHING;

-- D. SEED CARS
INSERT INTO public.cars (id, customer_id, license_plate, province, make, model, year, color, vin)
VALUES
    ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000011', 'กข 9999', 'กรุงเทพมหานคร', 'Honda', 'Civic Type R', 2023, 'Championship White', 'MRHFL5380NP000001'),
    ('20000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000021', 'รล 8888', 'ปทุมธานี', 'Toyota', 'GR Yaris', 2022, 'Emotional Red', 'JT1A1E52000000002')
ON CONFLICT (id) DO NOTHING;

-- E. SEED PRODUCTS
INSERT INTO public.products (id, sku, barcode, name, description, category, unit_price, retail_price)
VALUES
    ('30000000-0000-0000-0000-000000000011', 'WRAP-3M-SATINBLK', '8850123456789', '3M Satin Black Vinyl Wrap Roll', 'High-end 3M wrapping vinyl, 1.52m x 25m', 'wraps', 18000.00, 28000.00),
    ('30000000-0000-0000-0000-000000000021', 'CERM-GYON-Q2M', '8850123456796', 'Gyeon Q2 Mohs Ceramic Coating', 'Ultra-hard ceramic shield 100ml', 'coatings', 2500.00, 4500.00),
    ('30000000-0000-0000-0000-000000000031', 'EXH-AKRAP-EVO', '8850123456802', 'Akrapovic Evolution Line Exhaust System', 'Titanium full exhaust for Type R', 'exhausts', 75000.00, 115000.00),
    ('30000000-0000-0000-0000-000000000041', 'BODY-VARIS-FL5', '8850123456819', 'Varis Carbon Fiber Aero Kit', 'FL5 front lip and carbon wing', 'bodykits', 60000.00, 95000.00),
    ('30000000-0000-0000-0000-000000000051', 'LABOR-WRAP', NULL, 'Full Body Wrap Labor Fee', 'Professional wrapping labor charge', 'labor', 0.00, 15000.00)
ON CONFLICT (id) DO NOTHING;

-- F. SEED INVENTORIES
INSERT INTO public.inventories (id, branch_id, product_id, quantity, reorder_level)
VALUES
    ('40000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000011', 5, 2),
    ('40000000-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000021', 15, 5),
    ('40000000-0000-0000-0000-000000000031', '22222222-2222-2222-2222-222222222222', '30000000-0000-0000-0000-000000000031', 2, 1),
    ('40000000-0000-0000-0000-000000000041', '22222222-2222-2222-2222-222222222222', '30000000-0000-0000-0000-000000000021', 8, 5)
ON CONFLICT (id) DO NOTHING;

-- G. SEED APPOINTMENTS
INSERT INTO public.appointments (id, branch_id, customer_id, car_id, appointment_date, service_type, notes, status)
VALUES
    ('50000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000011', now() + interval '3 days', 'wrap', 'Customer requested 3M Satin Black wrap checkout booking.', 'confirmed'),
    ('50000000-0000-0000-0000-000000000021', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000021', now() + interval '5 days', 'exhaust', 'GR Yaris full Akrapovic titanium exhaust upgrade.', 'pending')
ON CONFLICT (id) DO NOTHING;

-- H. SEED JOBS
-- Note: Requires profile from public.profiles to satisfy created_by constraint
INSERT INTO public.jobs (id, branch_id, car_id, customer_id, status, created_by, scheduled_start, scheduled_end, total_amount)
SELECT val.id, val.branch_id, val.car_id, val.customer_id, val.status, val.created_by, val.scheduled_start, val.scheduled_end, val.total_amount
FROM (VALUES
    ('60000000-0000-0000-0000-000000000011'::UUID, '11111111-1111-1111-1111-111111111111'::UUID, '20000000-0000-0000-0000-000000000011'::UUID, '10000000-0000-0000-0000-000000000011'::UUID, 'in_progress', '00000000-0000-0000-0000-000000000011'::UUID, now() - interval '2 hours', now() + interval '5 hours', 43000.00),
    ('60000000-0000-0000-0000-000000000021'::UUID, '22222222-2222-2222-2222-222222222222'::UUID, '20000000-0000-0000-0000-000000000021'::UUID, '10000000-0000-0000-0000-000000000021'::UUID, 'scheduled', '00000000-0000-0000-0000-000000000021'::UUID, now() + interval '1 day', now() + interval '1 day 4 hours', 115000.00)
) AS val(id, branch_id, car_id, customer_id, status, created_by, scheduled_start, scheduled_end, total_amount)
JOIN public.profiles p ON p.id = val.created_by
ON CONFLICT (id) DO NOTHING;

-- I. SEED JOB_ASSIGNMENTS
-- Note: Requires profile and job to exist
INSERT INTO public.job_assignments (job_id, profile_id, assigned_role)
SELECT val.job_id, val.profile_id, val.assigned_role
FROM (VALUES
    ('60000000-0000-0000-0000-000000000011'::UUID, '00000000-0000-0000-0000-000000000031'::UUID, 'lead_technician'),
    ('60000000-0000-0000-0000-000000000011'::UUID, '00000000-0000-0000-0000-000000000032'::UUID, 'assistant_technician'),
    ('60000000-0000-0000-0000-000000000021'::UUID, '00000000-0000-0000-0000-000000000041'::UUID, 'lead_technician')
) AS val(job_id, profile_id, assigned_role)
JOIN public.jobs j ON j.id = val.job_id
JOIN public.profiles p ON p.id = val.profile_id
ON CONFLICT (job_id, profile_id) DO NOTHING;

-- J. SEED JOB_SERVICES
-- Note: Requires job and profile to exist (assigned_technician_id is nullable but must exist if set)
INSERT INTO public.job_services (id, job_id, name, description, price, status, assigned_technician_id)
SELECT val.id, val.job_id, val.name, val.description, val.price, val.status, val.assigned_technician_id
FROM (VALUES
    ('70000000-0000-0000-0000-000000000011'::UUID, '60000000-0000-0000-0000-000000000011'::UUID, 'Full Body Satin Black Wrap Service', 'Wrapping with premium 3M satin wrap including custom trim detailing', 28000.00, 'in_progress', '00000000-0000-0000-0000-000000000031'::UUID),
    ('70000000-0000-0000-0000-000000000021'::UUID, '60000000-0000-0000-0000-000000000011'::UUID, 'Full Body Wrap Labor Fee', 'Professional wrapping labor charge', 15000.00, 'in_progress', '00000000-0000-0000-0000-000000000032'::UUID)
) AS val(id, job_id, name, description, price, status, assigned_technician_id)
JOIN public.jobs j ON j.id = val.job_id
LEFT JOIN public.profiles p ON p.id = val.assigned_technician_id
WHERE val.assigned_technician_id IS NULL OR p.id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- K. SEED JOB_PARTS
-- Note: Requires job to exist
INSERT INTO public.job_parts (id, job_id, inventory_id, quantity, unit_price, total_price)
SELECT val.id, val.job_id, val.inventory_id, val.quantity, val.unit_price, val.total_price
FROM (VALUES
    ('80000000-0000-0000-0000-000000000011'::UUID, '60000000-0000-0000-0000-000000000011'::UUID, '40000000-0000-0000-0000-000000000011'::UUID, 1, 28000.00, 28000.00)
) AS val(id, job_id, inventory_id, quantity, unit_price, total_price)
JOIN public.jobs j ON j.id = val.job_id
ON CONFLICT (id) DO NOTHING;

-- L. SEED JOB_IMAGES
-- Note: Requires job and profile to exist
INSERT INTO public.job_images (id, job_id, image_url, image_type, description, uploaded_by)
SELECT val.id, val.job_id, val.image_url, val.image_type, val.description, val.uploaded_by
FROM (VALUES
    ('90000000-0000-0000-0000-000000000011'::UUID, '60000000-0000-0000-0000-000000000011'::UUID, 'https://supabase.co/storage/v1/object/public/job-photos/civic_before.jpg', 'before', 'Civic FL5 checked-in with minor front-lip paint scratches.', '00000000-0000-0000-0000-000000000011'::UUID)
) AS val(id, job_id, image_url, image_type, description, uploaded_by)
JOIN public.jobs j ON j.id = val.job_id
JOIN public.profiles p ON p.id = val.uploaded_by
ON CONFLICT (id) DO NOTHING;

-- M. SEED INVOICES & PAYMENTS
-- Note: Requires job to exist if job_id is set
INSERT INTO public.invoices (id, branch_id, job_id, customer_id, invoice_number, amount_due, tax_amount, discount_amount, total_amount, status, due_date)
SELECT val.id, val.branch_id, val.job_id, val.customer_id, val.invoice_number, val.amount_due, val.tax_amount, val.discount_amount, val.total_amount, val.status, val.due_date
FROM (VALUES
    ('a0000000-0000-0000-0000-000000000011'::UUID, '11111111-1111-1111-1111-111111111111'::UUID, '60000000-0000-0000-0000-000000000011'::UUID, '10000000-0000-0000-0000-000000000011'::UUID, 'INV-20260601-0001', 0.00, 3010.00, 0.00, 46010.00, 'paid', now() + interval '7 days')
) AS val(id, branch_id, job_id, customer_id, invoice_number, amount_due, tax_amount, discount_amount, total_amount, status, due_date)
LEFT JOIN public.jobs j ON j.id = val.job_id
WHERE val.job_id IS NULL OR j.id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, invoice_id, amount, payment_method, transaction_reference, payment_date)
SELECT val.id, val.invoice_id, val.amount, val.payment_method, val.transaction_reference, val.payment_date
FROM (VALUES
    ('b0000000-0000-0000-0000-000000000011'::UUID, 'a0000000-0000-0000-0000-000000000011'::UUID, 46010.00, 'bank_transfer', 'TXN-KPLUS-9823412', now())
) AS val(id, invoice_id, amount, payment_method, transaction_reference, payment_date)
JOIN public.invoices i ON i.id = val.invoice_id
ON CONFLICT (id) DO NOTHING;

-- N. SEED ATTENDANCE LOGS
-- Note: Requires profile to exist
INSERT INTO public.attendance_logs (profile_id, branch_id, clock_in, clock_out, status, latitude, longitude, selfie_url, notes)
SELECT val.profile_id, val.branch_id, val.clock_in, val.clock_out, val.status, val.latitude, val.longitude, val.selfie_url, val.notes
FROM (VALUES
    ('00000000-0000-0000-0000-000000000031'::UUID, '11111111-1111-1111-1111-111111111111'::UUID, now() - interval '8 hours', now(), 'on_time', 13.684400, 100.661100, 'https://supabase.co/storage/v1/object/public/selfies/u3333_clockout.jpg', 'Completed wrap shift successfully at Srinakarin Branch.'),
    ('00000000-0000-0000-0000-000000000032'::UUID, '11111111-1111-1111-1111-111111111111'::UUID, now() - interval '8 hours', now(), 'on_time', 13.684402, 100.661105, 'https://supabase.co/storage/v1/object/public/selfies/u4444_clockout.jpg', 'Assisted on FL5 wrap prep.')
) AS val(profile_id, branch_id, clock_in, clock_out, status, latitude, longitude, selfie_url, notes)
JOIN public.profiles p ON p.id = val.profile_id;

-- O. SEED POS_SALES & SALE ITEMS
-- Note: Requires profile and invoice (if set) to exist
INSERT INTO public.pos_sales (id, branch_id, customer_id, invoice_id, sales_number, subtotal, tax_amount, discount_amount, total_amount, status, created_by)
SELECT val.id, val.branch_id, val.customer_id, val.invoice_id, val.sales_number, val.subtotal, val.tax_amount, val.discount_amount, val.total_amount, val.status, val.created_by
FROM (VALUES
    ('c0000000-0000-0000-0000-000000000011'::UUID, '11111111-1111-1111-1111-111111111111'::UUID, '10000000-0000-0000-0000-000000000011'::UUID, NULL::UUID, 'POS-20260601-0001', 4500.00, 315.00, 0.00, 4815.00, 'completed', '00000000-0000-0000-0000-000000000001'::UUID)
) AS val(id, branch_id, customer_id, invoice_id, sales_number, subtotal, tax_amount, discount_amount, total_amount, status, created_by)
JOIN public.profiles p ON p.id = val.created_by
LEFT JOIN public.invoices i ON i.id = val.invoice_id
WHERE val.invoice_id IS NULL OR i.id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pos_sale_items (pos_sale_id, product_id, description, quantity, unit_price, total_price)
SELECT val.pos_sale_id, val.product_id, val.description, val.quantity, val.unit_price, val.total_price
FROM (VALUES
    ('c0000000-0000-0000-0000-000000000011'::UUID, '30000000-0000-0000-0000-000000000021'::UUID, 'Gyeon Q2 Mohs Ceramic Coating 100ml', 1, 4500.00, 4500.00)
) AS val(pos_sale_id, product_id, description, quantity, unit_price, total_price)
JOIN public.pos_sales ps ON ps.id = val.pos_sale_id;

-- P. SEED WARRANTIES & CLAIMS
-- Note: Requires job and pos_sale to exist if set
INSERT INTO public.warranties (id, customer_id, car_id, job_id, pos_sale_id, product_id, warranty_code, start_date, end_date, status)
SELECT val.id, val.customer_id, val.car_id, val.job_id, val.pos_sale_id, val.product_id, val.warranty_code, val.start_date, val.end_date, val.status
FROM (VALUES
    ('d0000000-0000-0000-0000-000000000011'::UUID, '10000000-0000-0000-0000-000000000011'::UUID, '20000000-0000-0000-0000-000000000011'::UUID, '60000000-0000-0000-0000-000000000011'::UUID, NULL::UUID, '30000000-0000-0000-0000-000000000011'::UUID, 'WRY-3MBLK-FL5-8821', now(), now() + interval '3 years', 'active')
) AS val(id, customer_id, car_id, job_id, pos_sale_id, product_id, warranty_code, start_date, end_date, status)
LEFT JOIN public.jobs j ON j.id = val.job_id
LEFT JOIN public.pos_sales ps ON ps.id = val.pos_sale_id
WHERE (val.job_id IS NULL OR j.id IS NOT NULL)
  AND (val.pos_sale_id IS NULL OR ps.id IS NOT NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.warranty_claims (warranty_id, claim_date, description, status, image_url, resolved_by, resolution_notes)
SELECT val.warranty_id, val.claim_date, val.description, val.status, val.image_url, val.resolved_by, val.resolution_notes
FROM (VALUES
    ('d0000000-0000-0000-0000-000000000011'::UUID, now() + interval '1 month', 'Rear spoiler corner wrap edge starting to lift slightly due to high temp.', 'completed', 'https://supabase.co/storage/v1/object/public/claims/defect1.jpg', '00000000-0000-0000-0000-000000000001'::UUID, 'Re-applied heat sealing adhesive at spoiler joint. Resolved under warranty.')
) AS val(warranty_id, claim_date, description, status, image_url, resolved_by, resolution_notes)
JOIN public.warranties w ON w.id = val.warranty_id
LEFT JOIN public.profiles p ON p.id = val.resolved_by
WHERE val.resolved_by IS NULL OR p.id IS NOT NULL;
