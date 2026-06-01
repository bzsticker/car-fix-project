# Database Schema Specifications - Refactored Version

This document outlines the refactored PostgreSQL database schema specifications for the **Den Modify Management System**, supporting multi-branch transactions, POS, inventory, warranties, and multi-technician job allocations.

---

## 1. Global Naming and Type Standards

- **Identifiers**: Lower snake_case for all tables, columns, constraints, and indexes.
- **Primary Keys**: 128-bit RFC 4122 UUIDs, using `gen_random_uuid()` (PostgreSQL 13+ native).
- **Timestamps**: All timestamps must use `TIMESTAMPTZ` (timestamp with time zone) to ensure correct local time mapping (e.g., matching the user's `+07:00` locale).
- **Currencies**: Decimal values representing prices and costs must use `NUMERIC(12, 2)` (supporting up to 9,999,999,999.99) to prevent floating-point rounding errors.
- **Soft Deletes**: Major transactional tables must include `deleted_at TIMESTAMPTZ NULL`. A record is active if `deleted_at IS NULL`.

---

## 2. Table Definitions

### 2.1 `branches`
Represents the workshop locations.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `name` **VARCHAR(100)** Not Null
- `address` **TEXT** Not Null
- `phone` **VARCHAR(20)** Not Null
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null

### 2.2 `profiles`
User metadata extending `auth.users`. Contains role information and branch mapping.
- `id` **UUID** Primary Key, references `auth.users` ON DELETE CASCADE
- `email` **VARCHAR(255)** Not Null, Unique
- `full_name` **VARCHAR(150)** Not Null
- `role` **VARCHAR(50)** Not Null (Constraint: `role IN ('owner', 'admin', 'technician')`)
- `branch_id` **UUID** Null, references `branches(id)` ON DELETE SET NULL (Nullable only for `owner`)
- `is_active` **BOOLEAN** Not Null, default `true`
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null

### 2.3 `customers`
Customer profiles, including contact information and LINE OA communication token.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `branch_id` **UUID** Not Null, references `branches(id)` ON DELETE RESTRICT
- `full_name` **VARCHAR(150)** Not Null
- `phone` **VARCHAR(20)** Not Null
- `email` **VARCHAR(255)** Null
- `line_user_id` **VARCHAR(100)** Null, Unique
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null

### 2.4 `cars`
Vehicles associated with customers.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `customer_id` **UUID** Not Null, references `customers(id)` ON DELETE CASCADE
- `license_plate` **VARCHAR(20)** Not Null
- `province` **VARCHAR(100)** Not Null
- `make` **VARCHAR(50)** Not Null
- `model` **VARCHAR(100)** Not Null
- `year` **INTEGER** Not Null
- `color` **VARCHAR(50)** Not Null
- `vin` **VARCHAR(50)** Null
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null

### 2.5 `products` [REVISED]
Master catalog of wraps, ceramic packages, exhausts, bodykits, and retail modifications.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `sku` **VARCHAR(100)** Not Null, Unique
- `barcode` **VARCHAR(100)** Null, Unique (Used for retail scanning and receipt checks)
- `name` **VARCHAR(200)** Not Null
- `description` **TEXT** Null
- `category` **VARCHAR(50)** Not Null CHECK (category IN ('wraps', 'exhausts', 'coatings', 'bodykits', 'accessories', 'labor'))
- `unit_price` **NUMERIC(12, 2)** Not Null CHECK (unit_price >= 0.00) (Cost price)
- `retail_price` **NUMERIC(12, 2)** Not Null CHECK (retail_price >= 0.00) (Base selling price)
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null

### 2.6 `inventories`
Branch-specific stock levels for catalog products.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `branch_id` **UUID** Not Null, references `branches(id)` ON DELETE CASCADE
- `product_id` **UUID** Not Null, references `products(id)` ON DELETE CASCADE
- `quantity` **INTEGER** Not Null DEFAULT 0 CHECK (quantity >= 0)
- `reorder_level` **INTEGER** Not Null DEFAULT 5 CHECK (reorder_level >= 0)
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null
- *Constraint*: Unique combination of `(branch_id, product_id)` to prevent duplicate listings.

### 2.7 `stock_movements`
Immutable ledger tracking stock increases, decreases, or transfers.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `inventory_id` **UUID** Not Null, references `inventories(id)` ON DELETE CASCADE
- `quantity` **INTEGER** Not Null CHECK (quantity <> 0)
- `type` **VARCHAR(50)** Not Null CHECK (type IN ('stock_in', 'job_consumption', 'transfer_in', 'transfer_out', 'manual_adjustment', 'write_off'))
- `reference_id` **UUID** Null
- `created_by` **UUID** Not Null, references `profiles(id)` ON DELETE RESTRICT
- `notes` **TEXT** Null
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`

### 2.8 `jobs`
Main work ticket for vehicle modifications and detailing.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `branch_id` **UUID** Not Null, references `branches(id)` ON DELETE RESTRICT
- `car_id` **UUID** Not Null, references `cars(id)` ON DELETE RESTRICT
- `customer_id` **UUID** Not Null, references `customers(id)` ON DELETE RESTRICT
- `status` **VARCHAR(50)** Not Null, default `'draft'` CHECK (
      status IN ('draft', 'pending_approval', 'scheduled', 'in_progress', 'awaiting_parts', 'qc', 'ready_for_pickup', 'completed', 'cancelled')
  )
- `created_by` **UUID** Not Null, references `profiles(id)` ON DELETE RESTRICT
- `scheduled_start` **TIMESTAMPTZ** Null
- `scheduled_end` **TIMESTAMPTZ** Null
- `actual_start` **TIMESTAMPTZ** Null
- `actual_end` **TIMESTAMPTZ** Null
- `notes` **TEXT** Null
- `total_amount` **NUMERIC(12, 2)** Not Null, default `0.00`
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null

### 2.9 `job_assignments`
Many-to-many relationship mapping multiple technicians to a single job.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `job_id` **UUID** Not Null, references `jobs(id)` ON DELETE CASCADE
- `profile_id` **UUID** Not Null, references `profiles(id)` ON DELETE CASCADE
- `assigned_role` **VARCHAR(50)** Not Null CHECK (assigned_role IN ('lead_technician', 'assistant_technician'))
- `assigned_at` **TIMESTAMPTZ** Not Null, default `now()`
- *Constraint*: Unique combination of `(job_id, profile_id)` to prevent duplicate team assignments.

### 2.10 `job_services`
Specific services or tasks requested inside a job.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `job_id` **UUID** Not Null, references `jobs(id)` ON DELETE CASCADE
- `name` **VARCHAR(200)** Not Null
- `description` **TEXT** Null
- `price` **NUMERIC(12, 2)** Not Null CHECK (price >= 0.00)
- `status` **VARCHAR(50)** Not Null, default `'pending'` CHECK (status IN ('pending', 'in_progress', 'completed'))
- `assigned_technician_id` **UUID** Null, references `profiles(id)` ON DELETE SET NULL
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`

### 2.11 `job_parts`
Parts allocated to a job, deducted from the branch's inventories.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `job_id` **UUID** Not Null, references `jobs(id)` ON DELETE CASCADE
- `inventory_id` **UUID** Not Null, references `inventories(id)` ON DELETE RESTRICT
- `quantity` **INTEGER** Not Null CHECK (quantity > 0)
- `unit_price` **NUMERIC(12, 2)** Not Null CHECK (unit_price >= 0.00)
- `total_price` **NUMERIC(12, 2)** Not Null CHECK (total_price >= 0.00)
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`

### 2.12 `job_images`
Photos uploaded for the job, documenting vehicle check-in, detailing progress, and quality checks.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `job_id` **UUID** Not Null, references `jobs(id)` ON DELETE CASCADE
- `image_url` **TEXT** Not Null
- `image_type` **VARCHAR(50)** Not Null CHECK (image_type IN ('before', 'in_progress', 'after', 'qc_fail'))
- `description` **TEXT** Null
- `uploaded_by` **UUID** Not Null, references `profiles(id)` ON DELETE RESTRICT
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`

### 2.13 `appointments` [NEW]
Customer bookings to schedule detailing, coating, or exhaust modifications.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `branch_id` **UUID** Not Null, references `branches(id)` ON DELETE CASCADE
- `customer_id` **UUID** Not Null, references `customers(id)` ON DELETE CASCADE
- `car_id` **UUID** Null, references `cars(id)` ON DELETE SET NULL (Nullable if they are a first-time customer booking for a new car)
- `appointment_date` **TIMESTAMPTZ** Not Null
- `service_type` **VARCHAR(50)** Not Null CHECK (service_type IN ('wrap', 'ceramic', 'exhaust', 'general_checkup'))
- `notes` **TEXT** Null
- `status` **VARCHAR(50)** Not Null DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed_to_job'))
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null

### 2.14 `quotes`
Quotations issued to customers.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `job_id` **UUID** Null, references `jobs(id)` ON DELETE SET NULL
- `branch_id` **UUID** Not Null, references `branches(id)` ON DELETE RESTRICT
- `car_id` **UUID** Not Null, references `cars(id)` ON DELETE RESTRICT
- `customer_id` **UUID** Not Null, references `customers(id)` ON DELETE RESTRICT
- `status` **VARCHAR(50)** Not Null, default `'draft'` CHECK (status IN ('draft', 'sent', 'approved', 'expired', 'rejected'))
- `valid_until` **TIMESTAMPTZ** Not Null
- `total_amount` **NUMERIC(12, 2)** Not Null, default `0.00`
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null

### 2.15 `quote_items`
Individual items inside a quotation.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `quote_id` **UUID** Not Null, references `quotes(id)` ON DELETE CASCADE
- `description` **TEXT** Not Null
- `quantity` **INTEGER** Not Null CHECK (quantity > 0)
- `unit_price` **NUMERIC(12, 2)** Not Null CHECK (unit_price >= 0.00)
- `total_price` **NUMERIC(12, 2)** Not Null CHECK (total_price >= 0.00)
- `item_type` **VARCHAR(50)** Not Null CHECK (item_type IN ('service', 'part'))

### 2.16 `invoices`
Invoices generated upon completion of jobs or POS retail sales.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `branch_id` **UUID** Not Null, references `branches(id)` ON DELETE RESTRICT
- `job_id` **UUID** Null, references `jobs(id)` ON DELETE SET NULL
- `customer_id` **UUID** Not Null, references `customers(id)` ON DELETE RESTRICT
- `invoice_number` **VARCHAR(50)** Not Null, Unique
- `amount_due` **NUMERIC(12, 2)** Not Null
- `tax_amount` **NUMERIC(12, 2)** Not Null, default `0.00`
- `discount_amount` **NUMERIC(12, 2)** Not Null, default `0.00`
- `total_amount` **NUMERIC(12, 2)** Not Null
- `status` **VARCHAR(50)** Not Null, default `'unpaid'` CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'void'))
- `due_date` **TIMESTAMPTZ** Not Null
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null

### 2.17 `payments`
Cash, bank transfer, and QR payments registered against invoices.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `invoice_id` **UUID** Not Null, references `invoices(id)` ON DELETE CASCADE
- `amount` **NUMERIC(12, 2)** Not Null CHECK (amount > 0.00)
- `payment_method` **VARCHAR(50)** Not Null CHECK (payment_method IN ('cash', 'credit_card', 'bank_transfer', 'qr_payment'))
- `transaction_reference` **VARCHAR(100)** Null
- `payment_date` **TIMESTAMPTZ** Not Null, default `now()`
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`

### 2.18 `pos_sales`
Point of Sale (POS) retail checkouts.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `branch_id` **UUID** Not Null, references `branches(id)` ON DELETE RESTRICT
- `customer_id` **UUID** Null, references `customers(id)` ON DELETE SET NULL
- `invoice_id` **UUID** Null, references `invoices(id)` ON DELETE SET NULL
- `sales_number` **VARCHAR(50)** Not Null, Unique
- `subtotal` **NUMERIC(12, 2)** Not Null CHECK (subtotal >= 0.00)
- `tax_amount` **NUMERIC(12, 2)** Not Null DEFAULT 0.00 CHECK (tax_amount >= 0.00)
- `discount_amount` **NUMERIC(12, 2)** Not Null DEFAULT 0.00 CHECK (discount_amount >= 0.00)
- `total_amount` **NUMERIC(12, 2)** Not Null CHECK (total_amount >= 0.00)
- `status` **VARCHAR(50)** Not Null DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'cancelled'))
- `created_by` **UUID** Not Null, references `profiles(id)` ON DELETE RESTRICT
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`

### 2.19 `pos_sale_items`
Individual product transactions inside a POS retail checkout.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `pos_sale_id` **UUID** Not Null, references `pos_sales(id)` ON DELETE CASCADE
- `product_id` **UUID** Null, references `products(id)` ON DELETE SET NULL
- `description` **VARCHAR(255)** Not Null
- `quantity` **INTEGER** Not Null CHECK (quantity > 0)
- `unit_price` **NUMERIC(12, 2)** Not Null CHECK (unit_price >= 0.00)
- `total_price` **NUMERIC(12, 2)** Not Null CHECK (total_price >= 0.00)

### 2.20 `attendance_logs` [REVISED]
Clock in / clock out registry for employees, now featuring GPS and selfie validation.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `profile_id` **UUID** Not Null, references `profiles(id)` ON DELETE CASCADE
- `branch_id` **UUID** Not Null, references `branches(id)` ON DELETE RESTRICT
- `clock_in` **TIMESTAMPTZ** Not Null
- `clock_out` **TIMESTAMPTZ** Null
- `status` **VARCHAR(50)** Not Null DEFAULT 'on_time' CHECK (status IN ('on_time', 'late', 'absent'))
- `latitude` **NUMERIC(9, 6)** Null (Stores geographical coordinates of clock event)
- `longitude` **NUMERIC(9, 6)** Null
- `selfie_url` **TEXT** Null (URL link to verification photo uploaded during clock action)
- `notes` **TEXT** Null
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`

### 2.21 `warranties`
Warranties issued for custom wraps, paint protection, or carbon fiber items.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `customer_id` **UUID** Not Null, references `customers(id)` ON DELETE RESTRICT
- `car_id` **UUID** Not Null, references `cars(id)` ON DELETE RESTRICT
- `job_id` **UUID** Null, references `jobs(id)` ON DELETE SET NULL
- `pos_sale_id` **UUID** Null, references `pos_sales(id)` ON DELETE SET NULL
- `product_id` **UUID** Null, references `products(id)` ON DELETE SET NULL
- `warranty_code` **VARCHAR(50)** Not Null, Unique
- `start_date` **TIMESTAMPTZ** Not Null
- `end_date` **TIMESTAMPTZ** Not Null
- `status` **VARCHAR(50)** Not Null DEFAULT 'active' CHECK (status IN ('active', 'expired', 'void'))
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`
- `deleted_at` **TIMESTAMPTZ** Null

### 2.22 `warranty_claims` [REVISED]
Claims logged under active warranties, now featuring image documentation.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `warranty_id` **UUID** Not Null, references `warranties(id)` ON DELETE RESTRICT
- `claim_date` **TIMESTAMPTZ** Not Null, default `now()`
- `description` **TEXT** Not Null
- `status` **VARCHAR(50)** Not Null DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed'))
- `image_url` **TEXT** Null (Photo of the defect/damage uploaded during claim)
- `resolved_by` **UUID** Null, references `profiles(id)` ON DELETE SET NULL
- `resolution_notes` **TEXT** Null
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`
- `updated_at` **TIMESTAMPTZ** Not Null, default `now()`

### 2.23 `audit_logs`
Enterprise-grade operational and configuration logs.
- `id` **UUID** Primary Key, default `gen_random_uuid()`
- `profile_id` **UUID** Null, references `profiles(id)` ON DELETE SET NULL
- `action` **VARCHAR(50)** Not Null
- `table_name` **VARCHAR(100)** Not Null
- `record_id` **UUID** Not Null
- `old_values` **JSONB** Null
- `new_values` **JSONB** Null
- `ip_address` **VARCHAR(45)** Null
- `created_at` **TIMESTAMPTZ** Not Null, default `now()`

---

## 3. High Performance Indexing Strategy

1. **Foreign Key Indexes**: Every single foreign key column is indexed to optimize database joins.
2. **Soft Delete Filters**: Core transactional tables use partial indexing to search active rows (`WHERE deleted_at IS NULL`).
3. **Compound Search Indexes**:
   - `cars(license_plate, province)`: Essential for rapid car search during check-in.
   - `customers(phone)`: Optimized for finding customer accounts on walk-in.
   - `appointments(appointment_date) WHERE deleted_at IS NULL`: High speed booking calendar lookup.
   - `inventories(branch_id, product_id) WHERE deleted_at IS NULL`: Quick branch catalog stock check.
   - `warranties(warranty_code) WHERE deleted_at IS NULL`: Clean active warranty claims registry.
