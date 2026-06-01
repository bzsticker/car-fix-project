# API Specification V2 - Production Version

This document defines the complete production-grade RESTful API Specifications for the **Den Modify Management System**. All endpoints are mapped to Next.js 15 route handlers, leveraging Supabase PostgreSQL and Row-Level Security.

---

## 1. Global API Standards

- **Base URL**: `/api/v1`
- **Content Type**: `application/json`
- **Authentication**: `Authorization: Bearer <jwt_token>` (Supabase User JWT containing custom `role` and `branch_id` metadata claims).

### 1.1 Standard Paginated Response
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_records": 142,
    "total_pages": 8
  }
}
```

### 1.2 Standard Error Codes & Payload
Error responses use standard HTTP status codes combined with application-specific error codes for clear client processing.
```json
{
  "error": {
    "code": "ERR_INSUFFICIENT_STOCK",
    "message": "The requested item quantity exceeds the available branch inventory stock levels.",
    "details": {
      "sku": "WRAP-3M-SATINBLK",
      "available_quantity": 0,
      "requested_quantity": 1
    }
  }
}
```

#### Code Roster:
- `ERR_BAD_REQUEST` (400): Malformed input body or parameters.
- `ERR_UNAUTHORIZED` (401): Missing or expired JWT credentials.
- `ERR_FORBIDDEN` (403): Role-based permission violation.
- `ERR_NOT_FOUND` (404): Record does not exist or has been soft-deleted.
- `ERR_VALIDATION` (422): Strict input types or check constraints failed.
- `ERR_LOW_STOCK` (422): Insufficient physical inventory at the target branch.
- `ERR_INTERNAL` (500): Database connection error or system failure.

---

## 2. API Endpoints by Module

---

### 2.1 Auth Module

#### `GET /api/v1/auth/session`
Retrieves details of the logged-in user's role and branch mapping.
- **Auth**: Authenticated (Owner, Admin, Technician)
- **Response**: `200 OK`
```json
{
  "user": {
    "id": "u1111111-1111-1111-1111-111111111111",
    "email": "admin1@denmodify.com",
    "full_name": "Somchai Branchone",
    "role": "admin",
    "branch_id": "b1111111-1111-1111-1111-111111111111"
  }
}
```

---

### 2.2 Customers Module

#### `GET /api/v1/customers`
Retrieves a paginated list of customers registered at the user's branch (Owner can query all).
- **Auth**: Owner, Admin, Technician
- **Query Params**:
  - `page` (integer, default `1`)
  - `limit` (integer, default `20`)
  - `search` (string, filters by name/phone/email)
  - `filter_branch_id` (UUID, Owner only)
  - `sort_by` (string: `created_at`, `full_name`, default `created_at`)
  - `sort_dir` (string: `asc`, `desc`, default `desc`)
- **Response**: `200 OK` (Paginated list of customer accounts)

#### `POST /api/v1/customers`
Registers a new customer.
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `branch_id`: UUID, Required
  - `full_name`: VARCHAR(150), Required
  - `phone`: VARCHAR(20) (Format: `+66...` or Thai local mobile), Required
  - `email`: VARCHAR(255) (Valid Email Format), Nullable
  - `line_user_id`: VARCHAR(100), Nullable
- **Response**: `201 Created` (Returns created customer object)

---

### 2.3 Vehicles Module

#### `GET /api/v1/vehicles`
- **Auth**: Owner, Admin, Technician
- **Query Params**: `search` (plates, VIN), `page`, `limit`
- **Response**: `200 OK`

#### `POST /api/v1/vehicles`
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `customer_id`: UUID, Required
  - `license_plate`: VARCHAR(20), Required
  - `province`: VARCHAR(100), Required
  - `make`: VARCHAR(50), Required
  - `model`: VARCHAR(100), Required
  - `year`: INTEGER (Range: `1900` to `current_year + 2`), Required
  - `color`: VARCHAR(50), Required
  - `vin`: VARCHAR(50), Nullable
- **Response**: `201 Created`

---

### 2.4 Appointments Module

#### `GET /api/v1/appointments`
- **Auth**: Owner, Admin, Technician
- **Query Params**: `filter_branch_id`, `filter_status` (`pending`, `confirmed`, `cancelled`), `page`, `limit`
- **Response**: `200 OK`

#### `POST /api/v1/appointments`
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `branch_id`: UUID, Required
  - `customer_id`: UUID, Required
  - `car_id`: UUID, Nullable
  - `appointment_date`: TIMESTAMPTZ (Must be in future), Required
  - `service_type`: CHECK IN (`wrap`, `ceramic`, `exhaust`, `general_checkup`), Required
  - `notes`: TEXT, Nullable
- **Response**: `201 Created`

#### `PUT /api/v1/appointments/:id`
Updates appointment details or transitions status.
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `status`: CHECK IN (`pending`, `confirmed`, `cancelled`, `completed_to_job`), Required
- **Response**: `200 OK`

---

### 2.5 Jobs Module

#### `GET /api/v1/jobs`
- **Auth**: Owner, Admin, Technician
- **Query Params**: `filter_status`, `assigned_tech_id`, `page`, `limit`
- **Response**: `200 OK`

#### `POST /api/v1/jobs`
Creates a work ticket from an approved quote or walk-in.
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `branch_id`: UUID, Required
  - `car_id`: UUID, Required
  - `customer_id`: UUID, Required
  - `scheduled_start`: TIMESTAMPTZ, Nullable
  - `scheduled_end`: TIMESTAMPTZ, Nullable
  - `notes`: TEXT, Nullable
- **Response**: `201 Created`

---

### 2.6 Quotations Module

#### `GET /api/v1/quotes`
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

#### `POST /api/v1/quotes`
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `branch_id`: UUID, Required
  - `customer_id`: UUID, Required
  - `car_id`: UUID, Required
  - `valid_until`: TIMESTAMPTZ (Must be in future), Required
  - `items`: ARRAY of Quote Items, Required:
    - `description`: TEXT, Required
    - `quantity`: INTEGER (positive), Required
    - `unit_price`: DECIMAL(12, 2), Required
    - `item_type`: CHECK IN (`service`, `part`), Required
- **Response**: `201 Created`

---

### 2.7 Invoices Module

#### `GET /api/v1/invoices`
- **Auth**: Owner, Admin, Technician (Technician is read-only)
- **Response**: `200 OK`

#### `POST /api/v1/invoices`
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `branch_id`: UUID, Required
  - `job_id`: UUID, Nullable
  - `customer_id`: UUID, Required
  - `due_date`: TIMESTAMPTZ, Required
  - `amount_due`: DECIMAL(12, 2) (positive), Required
  - `tax_amount`: DECIMAL(12, 2) (7% VAT defaults), Required
  - `discount_amount`: DECIMAL(12, 2), Required
- **Response**: `201 Created`

---

### 2.8 Payments Module

#### `POST /api/v1/payments`
Registers payment against an invoice.
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `invoice_id`: UUID, Required
  - `amount`: DECIMAL(12, 2) (positive, cannot exceed invoice amount_due), Required
  - `payment_method`: CHECK IN (`cash`, `credit_card`, `bank_transfer`, `qr_payment`), Required
  - `transaction_reference`: VARCHAR(100), Nullable
- **Response**: `201 Created`

---

### 2.9 POS Module

#### `POST /api/v1/pos/checkout`
Executes instant retail and accessory checkout, adjusting stock levels and emitting an invoice instantly.
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `branch_id`: UUID, Required
  - `customer_id`: UUID, Nullable
  - `subtotal`: DECIMAL(12, 2), Required
  - `tax_amount`: DECIMAL(12, 2), Required
  - `discount_amount`: DECIMAL(12, 2), Required
  - `total_amount`: DECIMAL(12, 2), Required
  - `payment_method`: CHECK IN (`cash`, `credit_card`, `bank_transfer`, `qr_payment`), Required
  - `transaction_reference`: VARCHAR(100), Nullable
  - `items`: ARRAY, Required:
    - `product_id`: UUID, Required
    - `quantity`: INTEGER (positive), Required
    - `unit_price`: DECIMAL(12, 2), Required
- **Response**: `201 Created`
```json
{
  "sales_number": "POS-20260601-0001",
  "invoice_number": "INV-POS-20260601-0001",
  "status": "completed",
  "total_amount": 4815.00
}
```

---

### 2.10 Products Module

#### `GET /api/v1/products`
- **Auth**: Owner, Admin, Technician (Full read catalog)
- **Response**: `200 OK`

#### `POST /api/v1/products`
- **Auth**: Owner
- **Request Body Validation**:
  - `sku`: VARCHAR(100) (Must be unique), Required
  - `barcode`: VARCHAR(100) (Must be unique), Nullable
  - `name`: VARCHAR(200), Required
  - `description`: TEXT, Nullable
  - `category`: CHECK IN (`wraps`, `exhausts`, `coatings`, `bodykits`, `accessories`, `labor`), Required
  - `unit_price`: DECIMAL(12,2) (>=0.00), Required
  - `retail_price`: DECIMAL(12,2) (>=0.00), Required
- **Response**: `201 Created`

---

### 2.11 Inventory Module

#### `GET /api/v1/inventory`
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

#### `PUT /api/v1/inventory/adjust`
Allows manual stock count corrections (logged automatically in ledger).
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `inventory_id`: UUID, Required
  - `new_quantity`: INTEGER (>=0), Required
  - `notes`: TEXT (Must state reasons for write-off/count adjustment), Required
- **Response**: `200 OK`

---

### 2.12 Transfers Module

#### `POST /api/v1/inventory/transfers`
Creates a stock transfer request from one branch to another.
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `source_branch_id`: UUID, Required
  - `destination_branch_id`: UUID, Required
  - `items`: ARRAY, Required:
    - `product_id`: UUID, Required
    - `quantity`: INTEGER (positive), Required
- **Response**: `201 Created`

#### `PUT /api/v1/inventory/transfers/:id`
Handles the shipment reception (increases local destination stock automatically).
- **Auth**: Owner, Admin (Admins can only accept at destination branch)
- **Request Body Validation**:
  - `status`: CHECK IN (`in_transit`, `received`, `rejected`), Required
- **Response**: `200 OK`

---

### 2.13 Attendance Module

#### `POST /api/v1/attendance/clock-in`
Registers daily clock in, verifying GPS proximity.
- **Auth**: Owner, Admin, Technician
- **Request Body Validation**:
  - `profile_id`: UUID (Must match `auth.uid()`), Required
  - `branch_id`: UUID, Required
  - `latitude`: DECIMAL(9, 6), Required
  - `longitude`: DECIMAL(9, 6), Required
  - `selfie_url`: TEXT (Valid URL to storage), Required
- **Response**: `201 Created`

#### `PUT /api/v1/attendance/clock-out`
- **Auth**: Owner, Admin, Technician
- **Request Body Validation**:
  - `attendance_log_id`: UUID, Required
  - `latitude`: DECIMAL(9, 6), Required
  - `longitude`: DECIMAL(9, 6), Required
- **Response**: `200 OK`

---

### 2.14 Warranty Module

#### `POST /api/v1/warranties`
Issues a warranty certificate.
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `customer_id`: UUID, Required
  - `car_id`: UUID, Required
  - `product_id`: UUID, Nullable
  - `warranty_code`: VARCHAR(50) (Must be unique), Required
  - `start_date`: TIMESTAMPTZ, Required
  - `end_date`: TIMESTAMPTZ (Must be after start_date), Required
- **Response**: `201 Created`

#### `POST /api/v1/warranties/claims`
- **Auth**: Owner, Admin, Technician
- **Request Body Validation**:
  - `warranty_id`: UUID, Required
  - `description`: TEXT, Required
  - `image_url`: TEXT, Nullable
- **Response**: `201 Created`

---

### 2.15 Reports Module

#### `GET /api/v1/reports/financials`
Retrieves consolidated and branch-specific financial indicators.
- **Auth**: Owner, Admin (Admins restricted to their branch details)
- **Query Params**: `start_date`, `end_date`, `branch_id`
- **Response**: `200 OK`
```json
{
  "total_revenue": 385450.00,
  "total_expense": 180000.00,
  "net_profit": 205450.00,
  "vat_collected": 26981.50
}
```

---

### 2.16 Settings Module

#### `GET /api/v1/settings/branch`
Retrieves active branch configs (e.g. coordinates thresholds for attendance).
- **Auth**: Owner, Admin
- **Response**: `200 OK`

#### `PUT /api/v1/settings/branch`
Updates branch properties.
- **Auth**: Owner, Admin (Admin restricted to their branch)
- **Request Body Validation**:
  - `name`: VARCHAR(100), Required
  - `phone`: VARCHAR(20), Required
  - `address`: TEXT, Required
- **Response**: `200 OK`
