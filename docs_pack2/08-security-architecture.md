# Security Architecture

The security architecture of the **Den Modify Management System** is built directly into the database engine using PostgreSQL **Row-Level Security (RLS)** and **Role-Based Access Control (RBAC)**.

Complete, copy-pasteable RLS policies and security helper functions are defined in:
- [20260601000000_init_schema.sql](file:///d:/AI%20LERNING/Car%20Fix%20project/supabase/migrations/20260601000000_init_schema.sql#L198-L342)

## Key Security Pillars

### 1. Custom Security Helper Functions
To prevent infinite recursion and maximize query planning performance, three helper functions bypass standard circular RLS lookups by running as `SECURITY DEFINER`:
- `is_owner()`: Checks if the logged-in user has the `owner` role.
- `is_branch_staff(branch_id)`: Checks if the user is the `owner` OR is an active `admin`/`technician` mapped to the specific branch.
- `get_user_branch_id()`: Retrieves the branch mapping for the logged-in user.

### 2. Role-Based Permissions (RBAC)

- **Owner**:
  - Full read/write access to all branches, profiles, inventory, jobs, customers, and financial records.
  - Can configure global settings and view cross-branch reports.

- **Admin**:
  - Full read/write access to jobs, customers, cars, quotes, inventory, invoices, and payments *within their assigned branch*.
  - View employee profiles *within their assigned branch*.
  - Cannot read or write data belonging to the other branch.

- **Technician**:
  - Read-only access to customer, car, and inventory records *within their assigned branch*.
  - Read access to jobs assigned to their branch.
  - Write access to update the status of services assigned directly to them.
  - Cannot view, create, or update quotes, invoices, payments, or administrative configurations.
