# API Specification V3 - Production Version

This document contains the production-grade RESTful API Specifications V3 for the **Den Modify Management System**. All endpoints are mapped to Next.js 15 route handlers, leveraging Supabase PostgreSQL and Row-Level Security.

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
Retrieves a paginated list of customers.
- **Auth**: Owner, Admin, Technician
- **Query Params**: `page`, `limit`, `search`, `filter_branch_id`
- **Response**: `200 OK`

#### `POST /api/v1/customers`
Registers a new customer.
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `branch_id`: UUID, Required
  - `full_name`: VARCHAR(150), Required
  - `phone`: VARCHAR(20), Required
  - `email`: VARCHAR(255), Nullable
  - `line_user_id`: VARCHAR(100), Nullable
- **Response**: `201 Created`

#### `GET /api/v1/customers/:id/timeline` [NEW]
Fetch chronological transaction, booking, and quote history for a customer.
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`
```json
{
  "customer_id": "c1111111-1111-1111-1111-111111111111",
  "timeline": [
    {
      "timestamp": "2026-06-01T17:30:00Z",
      "event_type": "payment_received",
      "description": "Payment of 46,010.00 THB received for Invoice #INV-20260601-0001",
      "reference_id": "m1111111-1111-1111-1111-111111111111"
    },
    {
      "timestamp": "2026-06-01T15:30:00Z",
      "event_type": "job_created",
      "description": "Job #j1111111 initialized for Civic Type R (Satin Black Wrap)",
      "reference_id": "j1111111-1111-1111-1111-111111111111"
    }
  ]
}
```

---

### 2.3 Vehicles Module

#### `GET /api/v1/vehicles`
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

#### `POST /api/v1/vehicles`
- **Auth**: Owner, Admin
- **Response**: `201 Created`

#### `GET /api/v1/vehicles/:id` [NEW]
Retrieves vehicle specifications and owner profile.
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`
```json
{
  "id": "a1111111-1111-1111-1111-111111111111",
  "license_plate": "กข 9999",
  "province": "กรุงเทพมหานคร",
  "make": "Honda",
  "model": "Civic Type R",
  "year": 2023,
  "color": "Championship White",
  "vin": "MRHFL5380NP000001",
  "customer": {
    "id": "c1111111-1111-1111-1111-111111111111",
    "full_name": "Apinan Speedster",
    "phone": "+6681-555-0199"
  }
}
```

#### `GET /api/v1/vehicles/:id/history` [NEW]
Fetches history of all custom modification jobs, quotes, and active warranties for a vehicle.
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`
```json
{
  "vehicle_id": "a1111111-1111-1111-1111-111111111111",
  "jobs": [
    {
      "id": "j1111111-1111-1111-1111-111111111111",
      "status": "in_progress",
      "total_amount": 43000.00,
      "created_at": "2026-06-01T12:00:00Z"
    }
  ],
  "warranties": [
    {
      "id": "w1111111-1111-1111-1111-111111111111",
      "warranty_code": "WRY-3MBLK-FL5-8821",
      "status": "active",
      "end_date": "2029-06-01T00:00:00Z"
    }
  ]
}
```

---

### 2.4 Appointments Module

#### `GET /api/v1/appointments`
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

#### `POST /api/v1/appointments`
- **Auth**: Owner, Admin
- **Response**: `201 Created`

---

### 2.5 Jobs Module

#### `GET /api/v1/jobs`
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

#### `POST /api/v1/jobs`
- **Auth**: Owner, Admin
- **Response**: `201 Created`

#### `GET /api/v1/jobs/:id` [NEW]
Fetches detailed nested fields of a job, showing tasks, parts, and teams.
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`
```json
{
  "id": "j1111111-1111-1111-1111-111111111111",
  "branch_id": "b1111111-1111-1111-1111-111111111111",
  "status": "in_progress",
  "total_amount": 43000.00,
  "car": {
    "id": "a1111111-1111-1111-1111-111111111111",
    "license_plate": "กข 9999",
    "make": "Honda",
    "model": "Civic Type R"
  },
  "customer": {
    "id": "c1111111-1111-1111-1111-111111111111",
    "full_name": "Apinan Speedster"
  },
  "services": [
    {
      "id": "s1111111-1111-1111-1111-111111111111",
      "name": "Full Body Satin Black Wrap Service",
      "price": 28000.00,
      "status": "in_progress"
    }
  ],
  "parts": [
    {
      "id": "p1111111-1111-1111-1111-111111111111",
      "sku": "WRAP-3M-SATINBLK",
      "quantity": 1,
      "total_price": 28000.00
    }
  ],
  "assignments": [
    {
      "profile_id": "u3333333-3333-3333-3333-333333333333",
      "full_name": "Prasert Wrapmaster",
      "assigned_role": "lead_technician"
    }
  ]
}
```

#### `PUT /api/v1/jobs/:id` [NEW]
Updates overall job notes, status, schedule times.
- **Auth**: Owner, Admin (Technician can update status if assigned)
- **Request Body Validation**:
  - `status`: CHECK IN (`scheduled`, `in_progress`, `qc`, `ready_for_pickup`, `completed`), Nullable
  - `notes`: TEXT, Nullable
  - `actual_end`: TIMESTAMPTZ, Nullable
- **Response**: `200 OK`

#### `GET /api/v1/jobs/:id/assignments` [NEW]
Lists technicians assigned to a job.
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

#### `POST /api/v1/jobs/:id/assignments` [NEW]
Assigns a technician to a job.
- **Auth**: Owner, Admin
- **Request Body Validation**:
  - `profile_id`: UUID, Required
  - `assigned_role`: CHECK IN (`lead_technician`, `assistant_technician`), Required
- **Response**: `201 Created`

#### `DELETE /api/v1/jobs/:id/assignments/:profile_id` [NEW]
Removes a technician from a job.
- **Auth**: Owner, Admin
- **Response**: `200 OK`

#### `GET /api/v1/jobs/:id/images` [NEW]
Lists photos uploaded for a job.
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

#### `POST /api/v1/jobs/:id/images` [NEW]
Uploads a progress/check-in photo.
- **Auth**: Owner, Admin, Technician
- **Request Body Validation**:
  - `image_url`: TEXT (Valid URL), Required
  - `image_type`: CHECK IN (`before`, `in_progress`, `after`, `qc_fail`), Required
  - `description`: TEXT, Nullable
- **Response**: `201 Created`

#### `DELETE /api/v1/jobs/:id/images/:image_id` [NEW]
Deletes a progress photo.
- **Auth**: Owner, Admin (Technician can delete if they uploaded it)
- **Response**: `200 OK`

#### `GET /api/v1/jobs/:id/timeline` [NEW]
Fetches chronological timeline event stream for a job (e.g. check-ins, photo uploads, QC ticks).
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`
```json
{
  "job_id": "j1111111-1111-1111-1111-111111111111",
  "timeline": [
    {
      "timestamp": "2026-06-01T15:45:00Z",
      "type": "photo_upload",
      "operator": "Prasert Wrapmaster",
      "description": "Progress photo uploaded (image_type: in_progress)",
      "payload": { "image_url": "https://supabase.co/.../civic_prep.jpg" }
    },
    {
      "timestamp": "2026-06-01T14:00:00Z",
      "type": "task_completed",
      "operator": "Wichai Carbon",
      "description": "Service Task marked COMPLETED: Paint Prep Correction"
    }
  ]
}
```

---

### 2.6 Quotations Module

#### `GET /api/v1/quotes`
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

#### `POST /api/v1/quotes`
- **Auth**: Owner, Admin
- **Response**: `201 Created`

---

### 2.7 Invoices Module

#### `GET /api/v1/invoices`
- **Auth**: Owner, Admin, Technician (Technician is read-only)
- **Response**: `200 OK`

---

### 2.8 Payments Module

#### `POST /api/v1/payments`
- **Auth**: Owner, Admin
- **Response**: `201 Created`

---

### 2.9 POS Module

#### `POST /api/v1/pos/checkout`
- **Auth**: Owner, Admin
- **Response**: `201 Created`

---

### 2.10 Products Module

#### `GET /api/v1/products`
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

#### `POST /api/v1/products`
- **Auth**: Owner
- **Response**: `201 Created`

---

### 2.11 Inventory Module

#### `GET /api/v1/inventory`
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

#### `PUT /api/v1/inventory/adjust`
- **Auth**: Owner, Admin
- **Response**: `200 OK`

---

### 2.12 Transfers Module

#### `POST /api/v1/inventory/transfers`
- **Auth**: Owner, Admin
- **Response**: `201 Created`

#### `PUT /api/v1/inventory/transfers/:id`
- **Auth**: Owner, Admin
- **Response**: `200 OK`

---

### 2.13 Attendance Module

#### `POST /api/v1/attendance/clock-in`
- **Auth**: Owner, Admin, Technician
- **Response**: `201 Created`

#### `PUT /api/v1/attendance/clock-out`
- **Auth**: Owner, Admin, Technician
- **Response**: `200 OK`

---

### 2.14 Warranty Module

#### `POST /api/v1/warranties`
- **Auth**: Owner, Admin
- **Response**: `201 Created`

#### `POST /api/v1/warranties/claims`
- **Auth**: Owner, Admin, Technician
- **Response**: `201 Created`

#### `PUT /api/v1/warranties/claims/:id/status` [NEW]
Warranty Claim Status Transition Workflow.
- **Auth**: Owner, Admin (Admins can resolve claims at their branch)
- **Request Body Validation**:
  - `status`: CHECK IN (`approved`, `rejected`, `completed`), Required
  - `resolution_notes`: TEXT, Required
  - `resolved_by`: UUID (Defaults to `auth.uid()`), Required
- **Response**: `200 OK`
```json
{
  "claim_id": "c1111111-1111-1111-1111-111111111111",
  "status": "completed",
  "resolution_notes": "Edge heat sealed. Resolved under warranty.",
  "updated_at": "2026-06-01T17:35:00Z"
}
```

---

### 2.15 Reports Module

#### `GET /api/v1/reports/revenue` [NEW]
Fetches revenue and gross margins, categorized by products and services.
- **Auth**: Owner, Admin (Admin restricted to their branch details)
- **Query Params**: `start_date`, `end_date`, `branch_id`
- **Response**: `200 OK`
```json
{
  "branch_id": "b1111111-1111-1111-1111-111111111111",
  "total_revenue": 385450.00,
  "by_category": {
    "wraps": 260000.00,
    "coatings": 45000.00,
    "exhausts": 80450.00
  }
}
```

#### `GET /api/v1/reports/inventory` [NEW]
Provides stock valuation indices and transaction movement summaries.
- **Auth**: Owner, Admin (Admin restricted to their branch)
- **Query Params**: `branch_id`
- **Response**: `200 OK`
```json
{
  "branch_id": "b1111111-1111-1111-1111-111111111111",
  "stock_valuation_cost": 165000.00,
  "stock_valuation_retail": 245000.00,
  "low_stock_items_count": 1
}
```

#### `GET /api/v1/reports/attendance` [NEW]
Fetches summaries of hours worked, overtime, and clock exceptions.
- **Auth**: Owner, Admin (Admin restricted to their branch)
- **Query Params**: `start_date`, `end_date`, `branch_id`
- **Response**: `200 OK`

---

### 2.16 Settings Module

#### `GET /api/v1/settings/branch`
- **Auth**: Owner, Admin
- **Response**: `200 OK`

#### `PUT /api/v1/settings/branch`
- **Auth**: Owner, Admin
- **Response**: `200 OK`
