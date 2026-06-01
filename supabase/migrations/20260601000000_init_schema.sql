-- Migrations: 20260601000000_init_schema.sql
-- Description: Consolidated production database schema with 23 tables, RLS, triggers, indexes, and full branch seed records.

-- Enable UUID and crypto extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. BASE TABLES
-- =========================================================================

-- BRANCHES
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- PROFILES (Linked 1:1 to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'technician')),
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Owner must not have branch_id. Admin/Technician MUST have branch_id.
    CONSTRAINT check_role_branch_association CHECK (
        (role = 'owner' AND branch_id IS NULL) OR
        (role IN ('admin', 'technician') AND branch_id IS NOT NULL)
    )
);

-- CUSTOMERS
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NULL,
    line_user_id VARCHAR(100) NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- CARS
CREATE TABLE public.cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    license_plate VARCHAR(20) NOT NULL,
    province VARCHAR(100) NOT NULL,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1900 AND year <= extract(year from now()) + 2),
    color VARCHAR(50) NOT NULL,
    vin VARCHAR(50) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- PRODUCTS
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) NOT NULL UNIQUE,
    barcode VARCHAR(100) NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('wraps', 'exhausts', 'coatings', 'bodykits', 'accessories', 'labor')),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0.00),
    retail_price NUMERIC(12, 2) NOT NULL CHECK (retail_price >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- INVENTORIES
CREATE TABLE public.inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reorder_level INTEGER NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    CONSTRAINT unique_branch_product UNIQUE (branch_id, product_id)
);

-- STOCK_MOVEMENTS (Immutable ledger)
CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity <> 0),
    type VARCHAR(50) NOT NULL CHECK (type IN ('stock_in', 'job_consumption', 'transfer_in', 'transfer_out', 'manual_adjustment', 'write_off')),
    reference_id UUID NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- JOBS
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'pending_approval', 'scheduled', 'in_progress', 'awaiting_parts', 'qc', 'ready_for_pickup', 'completed', 'cancelled')
    ),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    scheduled_start TIMESTAMPTZ NULL,
    scheduled_end TIMESTAMPTZ NULL,
    actual_start TIMESTAMPTZ NULL,
    actual_end TIMESTAMPTZ NULL,
    notes TEXT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- JOB_ASSIGNMENTS (Many-to-many team assignments)
CREATE TABLE public.job_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_role VARCHAR(50) NOT NULL CHECK (assigned_role IN ('lead_technician', 'assistant_technician')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_job_technician UNIQUE (job_id, profile_id)
);

-- JOB_SERVICES
CREATE TABLE public.job_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0.00),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    assigned_technician_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- JOB_PARTS (Linked to inventories)
CREATE TABLE public.job_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0.00),
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- JOB_IMAGES
CREATE TABLE public.job_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type VARCHAR(50) NOT NULL CHECK (image_type IN ('before', 'in_progress', 'after', 'qc_fail')),
    description TEXT NULL,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- APPOINTMENTS (Bookings calendar)
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    car_id UUID NULL REFERENCES public.cars(id) ON DELETE SET NULL,
    appointment_date TIMESTAMPTZ NOT NULL,
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('wrap', 'ceramic', 'exhaust', 'general_checkup')),
    notes TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed_to_job')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- QUOTES
CREATE TABLE public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NULL REFERENCES public.jobs(id) ON DELETE SET NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'expired', 'rejected')),
    valid_until TIMESTAMPTZ NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- QUOTE_ITEMS
CREATE TABLE public.quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0.00),
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0.00),
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('service', 'part'))
);

-- INVOICES
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    job_id UUID NULL REFERENCES public.jobs(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    amount_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_due >= 0.00),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0.00),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0.00),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0.00),
    status VARCHAR(50) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'void')),
    due_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- PAYMENTS
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0.00),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'credit_card', 'bank_transfer', 'qr_payment')),
    transaction_reference VARCHAR(100) NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS_SALES
CREATE TABLE public.pos_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL,
    invoice_id UUID NULL REFERENCES public.invoices(id) ON DELETE SET NULL,
    sales_number VARCHAR(50) NOT NULL UNIQUE,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0.00),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0.00),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0.00),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0.00),
    status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'cancelled')),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS_SALE_ITEMS
CREATE TABLE public.pos_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_sale_id UUID NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
    product_id UUID NULL REFERENCES public.products(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0.00),
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0.00)
);

-- ATTENDANCE_LOGS (Featuring GPS coordinates and selfie link)
CREATE TABLE public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'on_time' CHECK (status IN ('on_time', 'late', 'absent')),
    latitude NUMERIC(9, 6) NULL,
    longitude NUMERIC(9, 6) NULL,
    selfie_url TEXT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT clock_out_after_in CHECK (clock_out IS NULL OR clock_out >= clock_in)
);

-- WARRANTIES
CREATE TABLE public.warranties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
    job_id UUID NULL REFERENCES public.jobs(id) ON DELETE SET NULL,
    pos_sale_id UUID NULL REFERENCES public.pos_sales(id) ON DELETE SET NULL,
    product_id UUID NULL REFERENCES public.products(id) ON DELETE SET NULL,
    warranty_code VARCHAR(50) NOT NULL UNIQUE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'void')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    CONSTRAINT end_date_after_start CHECK (end_date >= start_date)
);

-- WARRANTY_CLAIMS (Featuring image documentation)
CREATE TABLE public.warranty_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warranty_id UUID NOT NULL REFERENCES public.warranties(id) ON DELETE RESTRICT,
    claim_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    image_url TEXT NULL,
    resolved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AUDIT_LOGS
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 2. INDEXES FOR PERFORMANCE
-- =========================================================================

-- Core Foreign Keys
CREATE INDEX idx_profiles_branch ON public.profiles(branch_id);
CREATE INDEX idx_customers_branch ON public.customers(branch_id);
CREATE INDEX idx_cars_customer ON public.cars(customer_id);
CREATE INDEX idx_inventories_branch ON public.inventories(branch_id);
CREATE INDEX idx_inventories_product ON public.inventories(product_id);
CREATE INDEX idx_stock_movements_inventory ON public.stock_movements(inventory_id);
CREATE INDEX idx_stock_movements_creator ON public.stock_movements(created_by);
CREATE INDEX idx_jobs_branch ON public.jobs(branch_id);
CREATE INDEX idx_jobs_car ON public.jobs(car_id);
CREATE INDEX idx_jobs_customer ON public.jobs(customer_id);
CREATE INDEX idx_jobs_creator ON public.jobs(created_by);
CREATE INDEX idx_job_assignments_job ON public.job_assignments(job_id);
CREATE INDEX idx_job_assignments_profile ON public.job_assignments(profile_id);
CREATE INDEX idx_job_services_job ON public.job_services(job_id);
CREATE INDEX idx_job_parts_job ON public.job_parts(job_id);
CREATE INDEX idx_job_parts_inventory ON public.job_parts(inventory_id);
CREATE INDEX idx_job_images_job ON public.job_images(job_id);
CREATE INDEX idx_appointments_branch ON public.appointments(branch_id);
CREATE INDEX idx_appointments_customer ON public.appointments(customer_id);
CREATE INDEX idx_quotes_branch ON public.quotes(branch_id);
CREATE INDEX idx_quotes_customer ON public.quotes(customer_id);
CREATE INDEX idx_quote_items_quote ON public.quote_items(quote_id);
CREATE INDEX idx_invoices_branch ON public.invoices(branch_id);
CREATE INDEX idx_invoices_job ON public.invoices(job_id);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX idx_pos_sales_branch ON public.pos_sales(branch_id);
CREATE INDEX idx_pos_sales_customer ON public.pos_sales(customer_id);
CREATE INDEX idx_pos_sales_invoice ON public.pos_sales(invoice_id);
CREATE INDEX idx_pos_sale_items_sale ON public.pos_sale_items(pos_sale_id);
CREATE INDEX idx_attendance_profile ON public.attendance_logs(profile_id);
CREATE INDEX idx_warranties_customer ON public.warranties(customer_id);
CREATE INDEX idx_warranties_car ON public.warranties(car_id);
CREATE INDEX idx_warranty_claims_warranty ON public.warranty_claims(warranty_id);

-- Soft Delete Filtered Indexes
CREATE INDEX idx_profiles_active ON public.profiles(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_active ON public.customers(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cars_active ON public.cars(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_active ON public.products(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventories_active ON public.inventories(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_active ON public.jobs(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_active ON public.appointments(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_active ON public.quotes(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_active ON public.invoices(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_warranties_active ON public.warranties(id) WHERE deleted_at IS NULL;

-- Business Search Indexing
CREATE INDEX idx_cars_search_plate ON public.cars(license_plate, province);
CREATE INDEX idx_customers_search_phone ON public.customers(phone);
CREATE INDEX idx_warranties_search_code ON public.warranties(warranty_code) WHERE deleted_at IS NULL;

-- =========================================================================
-- 3. TRIGGERS & FUNCTIONS
-- =========================================================================

-- Trigger to Automatically Update `updated_at` Column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_cars_updated_at BEFORE UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_inventories_updated_at BEFORE UPDATE ON public.inventories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_job_services_updated_at BEFORE UPDATE ON public.job_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_job_parts_updated_at BEFORE UPDATE ON public.job_parts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_pos_sales_updated_at BEFORE UPDATE ON public.pos_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_warranties_updated_at BEFORE UPDATE ON public.warranties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_warranty_claims_updated_at BEFORE UPDATE ON public.warranty_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inventory Stock Trigger
CREATE OR REPLACE FUNCTION public.handle_job_parts_insertion()
RETURNS TRIGGER AS $$
DECLARE
    creator_id UUID;
BEGIN
    UPDATE public.inventories
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.inventory_id;
    
    SELECT created_by INTO creator_id FROM public.jobs WHERE id = NEW.job_id;
    
    INSERT INTO public.stock_movements (inventory_id, quantity, type, reference_id, created_by, notes)
    VALUES (
        NEW.inventory_id,
        -NEW.quantity,
        'job_consumption',
        NEW.job_id,
        creator_id,
        'Auto-consumed by Job ID: ' || NEW.job_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_job_parts_inserted AFTER INSERT ON public.job_parts FOR EACH ROW EXECUTE FUNCTION public.handle_job_parts_insertion();

-- Auto Profile Creation Trigger on auth.users insertion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role VARCHAR(50);
    default_branch UUID;
BEGIN
    default_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'technician');
    BEGIN
        default_branch := (NEW.raw_user_meta_data ->> 'branch_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
        default_branch := NULL;
    END;
    
    INSERT INTO public.profiles (id, email, full_name, role, branch_id, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        default_role,
        default_branch,
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS for all tables
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'owner',
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID AS $$
BEGIN
    RETURN (auth.jwt() -> 'user_metadata' ->> 'branch_id')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_branch_admin(target_branch_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (
            SELECT role = 'admin'
            FROM public.profiles
            WHERE id = auth.uid()
              AND branch_id = target_branch_id
              AND is_active = true
              AND deleted_at IS NULL
        ),
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_branch_staff(target_branch_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        public.is_owner() OR
        (
            SELECT role IN ('admin', 'technician')
            FROM public.profiles
            WHERE id = auth.uid()
              AND branch_id = target_branch_id
              AND is_active = true
              AND deleted_at IS NULL
        ),
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- BRANCHES
CREATE POLICY select_branches ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY modify_branches ON public.branches FOR ALL TO authenticated USING (public.is_owner());

-- PROFILES
CREATE POLICY select_profiles ON public.profiles FOR SELECT TO authenticated
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'owner' OR
        id = auth.uid() OR
        branch_id = (auth.jwt() -> 'user_metadata' ->> 'branch_id')::UUID
    );
CREATE POLICY modify_profiles ON public.profiles FOR ALL TO authenticated USING (public.is_owner());

-- CUSTOMERS
CREATE POLICY select_customers ON public.customers FOR SELECT TO authenticated 
    USING (public.is_branch_staff(branch_id));
CREATE POLICY modify_customers ON public.customers FOR ALL TO authenticated 
    USING (public.is_owner() OR public.is_branch_admin(branch_id))
    WITH CHECK (public.is_owner() OR public.is_branch_admin(branch_id));

-- CARS
CREATE POLICY select_cars ON public.cars FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.branch_id = public.get_user_branch_id())
    );
CREATE POLICY modify_cars ON public.cars FOR ALL TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.is_branch_admin(c.branch_id))
    )
    WITH CHECK (
        public.is_owner() OR
        EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.is_branch_admin(c.branch_id))
    );

-- PRODUCTS
CREATE POLICY select_products ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY modify_products ON public.products FOR ALL TO authenticated USING (public.is_owner());

-- INVENTORIES
CREATE POLICY select_inventory ON public.inventories FOR SELECT TO authenticated 
    USING (public.is_branch_staff(branch_id));
CREATE POLICY modify_inventory ON public.inventories FOR ALL TO authenticated 
    USING (public.is_owner() OR public.is_branch_admin(branch_id))
    WITH CHECK (public.is_owner() OR public.is_branch_admin(branch_id));

-- STOCK MOVEMENTS
CREATE POLICY select_movements ON public.stock_movements FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (
            SELECT 1 FROM public.inventories i 
            WHERE i.id = inventory_id AND public.is_branch_staff(i.branch_id)
        )
    );
CREATE POLICY insert_movements ON public.stock_movements FOR INSERT TO authenticated 
    WITH CHECK (
        public.is_owner() OR 
        EXISTS (
            SELECT 1 FROM public.inventories i 
            WHERE i.id = inventory_id AND public.is_branch_admin(i.branch_id)
        )
    );

-- JOBS
CREATE POLICY select_jobs ON public.jobs FOR SELECT TO authenticated 
    USING (public.is_branch_staff(branch_id));
CREATE POLICY modify_jobs ON public.jobs FOR ALL TO authenticated 
    USING (public.is_owner() OR public.is_branch_admin(branch_id))
    WITH CHECK (public.is_owner() OR public.is_branch_admin(branch_id));

-- JOB TEAM ASSIGNMENTS
CREATE POLICY select_job_assignments ON public.job_assignments FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_branch_staff(j.branch_id))
    );
CREATE POLICY modify_job_assignments ON public.job_assignments FOR ALL TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (
            SELECT 1 FROM public.jobs j 
            WHERE j.id = job_id AND public.is_branch_admin(j.branch_id)
        )
    )
    WITH CHECK (
        public.is_owner() OR
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id AND public.is_branch_admin(j.branch_id)
        )
    );

-- SERVICES & PARTS
CREATE POLICY select_job_services ON public.job_services FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_branch_staff(j.branch_id))
    );
CREATE POLICY modify_job_services ON public.job_services FOR ALL TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_branch_admin(j.branch_id)) OR
        (
            assigned_technician_id = auth.uid() AND
            EXISTS (
                SELECT 1 FROM public.jobs j
                WHERE j.id = job_id AND public.is_branch_staff(j.branch_id)
            )
        )
    )
    WITH CHECK (
        public.is_owner() OR
        EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_branch_admin(j.branch_id)) OR
        (
            assigned_technician_id = auth.uid() AND
            EXISTS (
                SELECT 1 FROM public.jobs j
                WHERE j.id = job_id AND public.is_branch_staff(j.branch_id)
            )
        )
    );

CREATE POLICY select_job_parts ON public.job_parts FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_branch_staff(j.branch_id))
    );
CREATE POLICY modify_job_parts ON public.job_parts FOR ALL TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_branch_admin(j.branch_id))
    )
    WITH CHECK (
        public.is_owner() OR
        EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_branch_admin(j.branch_id))
    );

-- JOB IMAGES
CREATE POLICY select_job_images ON public.job_images FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_branch_staff(j.branch_id))
    );
CREATE POLICY insert_job_images ON public.job_images FOR INSERT TO authenticated 
    WITH CHECK (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_branch_staff(j.branch_id))
    );
CREATE POLICY modify_job_images ON public.job_images FOR UPDATE TO authenticated 
    USING (
        public.is_owner() OR
        uploaded_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id AND public.is_branch_admin(j.branch_id)
        )
    )
    WITH CHECK (
        public.is_owner() OR
        uploaded_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id AND public.is_branch_admin(j.branch_id)
        )
    );
CREATE POLICY delete_job_images ON public.job_images FOR DELETE TO authenticated 
    USING (
        public.is_owner() OR
        uploaded_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id AND public.is_branch_admin(j.branch_id)
        )
    );

-- APPOINTMENTS
CREATE POLICY select_appointments ON public.appointments FOR SELECT TO authenticated 
    USING (public.is_branch_staff(branch_id));
CREATE POLICY modify_appointments ON public.appointments FOR ALL TO authenticated 
    USING (public.is_owner() OR public.is_branch_admin(branch_id))
    WITH CHECK (public.is_owner() OR public.is_branch_admin(branch_id));

-- QUOTES & ITEMS
CREATE POLICY select_quotes ON public.quotes FOR SELECT TO authenticated 
    USING (public.is_branch_staff(branch_id));
CREATE POLICY modify_quotes ON public.quotes FOR ALL TO authenticated 
    USING (public.is_owner() OR public.is_branch_admin(branch_id))
    WITH CHECK (public.is_owner() OR public.is_branch_admin(branch_id));

CREATE POLICY select_quote_items ON public.quote_items FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.is_branch_staff(q.branch_id))
    );
CREATE POLICY modify_quote_items ON public.quote_items FOR ALL TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.is_branch_admin(q.branch_id))
    )
    WITH CHECK (
        public.is_owner() OR
        EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.is_branch_admin(q.branch_id))
    );

-- INVOICES & PAYMENTS
CREATE POLICY select_invoices ON public.invoices FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR
        public.is_branch_admin(branch_id) OR
        (
            public.get_user_branch_id() = branch_id AND
            EXISTS (
                SELECT 1
                FROM public.jobs j
                JOIN public.job_assignments ja ON ja.job_id = j.id
                WHERE j.id = job_id AND ja.profile_id = auth.uid()
            )
        )
    );
CREATE POLICY modify_invoices ON public.invoices FOR ALL TO authenticated 
    USING (public.is_owner() OR public.is_branch_admin(branch_id))
    WITH CHECK (public.is_owner() OR public.is_branch_admin(branch_id));

CREATE POLICY select_payments ON public.payments FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.branch_id = public.get_user_branch_id())
    );
CREATE POLICY modify_payments ON public.payments FOR ALL TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (
            SELECT 1 FROM public.invoices i 
            WHERE i.id = invoice_id AND public.is_branch_admin(i.branch_id)
        )
    )
    WITH CHECK (
        public.is_owner() OR
        EXISTS (
            SELECT 1 FROM public.invoices i
            WHERE i.id = invoice_id AND public.is_branch_admin(i.branch_id)
        )
    );

-- POS SALES & ITEMS
CREATE POLICY select_pos ON public.pos_sales FOR SELECT TO authenticated 
    USING (public.is_branch_staff(branch_id));
CREATE POLICY insert_pos ON public.pos_sales FOR INSERT TO authenticated 
    WITH CHECK (public.is_owner() OR public.is_branch_admin(branch_id));
CREATE POLICY modify_pos ON public.pos_sales FOR UPDATE TO authenticated 
    USING (public.is_owner() OR public.is_branch_admin(branch_id))
    WITH CHECK (public.is_owner() OR public.is_branch_admin(branch_id));
CREATE POLICY delete_pos ON public.pos_sales FOR DELETE TO authenticated 
    USING (public.is_owner());

CREATE POLICY select_pos_items ON public.pos_sale_items FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.pos_sales p WHERE p.id = pos_sale_id AND public.is_branch_staff(p.branch_id))
    );
CREATE POLICY modify_pos_items ON public.pos_sale_items FOR ALL TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (SELECT 1 FROM public.pos_sales p WHERE p.id = pos_sale_id AND public.is_branch_admin(p.branch_id))
    )
    WITH CHECK (
        public.is_owner() OR
        EXISTS (SELECT 1 FROM public.pos_sales p WHERE p.id = pos_sale_id AND public.is_branch_admin(p.branch_id))
    );

-- ATTENDANCE LOGS
CREATE POLICY select_attendance ON public.attendance_logs FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        profile_id = auth.uid() OR 
        public.is_branch_admin(branch_id)
    );
CREATE POLICY insert_attendance ON public.attendance_logs FOR INSERT TO authenticated 
    WITH CHECK (profile_id = auth.uid());
CREATE POLICY update_attendance ON public.attendance_logs FOR UPDATE TO authenticated 
    USING (
        public.is_owner() OR 
        profile_id = auth.uid() OR 
        public.is_branch_admin(branch_id)
    )
    WITH CHECK (
        public.is_owner() OR
        profile_id = auth.uid() OR
        public.is_branch_admin(branch_id)
    );
CREATE POLICY delete_attendance ON public.attendance_logs FOR DELETE TO authenticated 
    USING (public.is_owner());

-- WARRANTIES & CLAIMS
CREATE POLICY select_warranties ON public.warranties FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (
            SELECT 1 FROM public.customers c 
            WHERE c.id = customer_id AND public.is_branch_staff(c.branch_id)
        )
    );
CREATE POLICY modify_warranties ON public.warranties FOR ALL TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (
            SELECT 1 FROM public.customers c 
            WHERE c.id = customer_id AND public.is_branch_admin(c.branch_id)
        )
    )
    WITH CHECK (
        public.is_owner() OR
        EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id AND public.is_branch_admin(c.branch_id)
        )
    );

CREATE POLICY select_claims ON public.warranty_claims FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (
            SELECT 1 FROM public.warranties w
            JOIN public.customers c ON c.id = w.customer_id
            WHERE w.id = warranty_id AND public.is_branch_staff(c.branch_id)
        )
    );
CREATE POLICY modify_claims ON public.warranty_claims FOR ALL TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (
            SELECT 1 FROM public.warranties w
            JOIN public.customers c ON c.id = w.customer_id
            WHERE w.id = warranty_id AND public.is_branch_admin(c.branch_id)
        )
    )
    WITH CHECK (
        public.is_owner() OR
        EXISTS (
            SELECT 1 FROM public.warranties w
            JOIN public.customers c ON c.id = w.customer_id
            WHERE w.id = warranty_id AND public.is_branch_admin(c.branch_id)
        )
    );

-- AUDIT LOGS
CREATE POLICY select_audit ON public.audit_logs FOR SELECT TO authenticated 
    USING (
        public.is_owner() OR 
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = profile_id AND public.is_branch_admin(p.branch_id)
        )
    );
