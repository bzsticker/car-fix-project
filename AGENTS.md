# Den Modify Management System

## Project Overview

Multi-branch automotive workshop management platform.

Tech stack:

* Next.js App Router
* TypeScript
* Supabase
* TailwindCSS
* Vercel

---

## User Roles

### Owner

Can access:

* all branches
* all customers
* all vehicles
* all jobs
* all invoices
* all reports
* all inventory

### Admin

Can access:

* assigned branch only

### Technician

Can access:

* assigned branch only
* assigned jobs only

---

## Database Rules

* Never hardcode UUID values.
* Always query actual branch records.
* Respect Supabase RLS policies.
* Owner pages may use createAdminClient().
* Branch pages must use profile.branch_id filtering.
* Never bypass role validation.

---

## UI Rules

Use existing Den Modify design system:

* black background
* red primary actions
* dark cards
* consistent sidebar navigation
* mobile responsive

Do not redesign working pages unless requested.

---

## Coding Rules

* TypeScript strict mode
* No any types unless unavoidable
* Reuse existing components
* Reuse existing lib/supabase utilities
* Keep code production-safe
* Do not break existing routes

---

## Current Project Status

Phase 1 Complete

Completed:

* Authentication
* Roles
* Branch assignment
* Customers
* Owner dashboard
* Reports
* Vercel deployment

---

## Current Phase

Phase 2A

Workflow:

Customer
→ Vehicle
→ Job
→ Invoice

Priority:

1. Owner customer management
2. Vehicle management
3. Job workflow
4. Invoice workflow
5. Inventory workflow

Attendance and roster are lower priority.

---

## Before Making Changes

Always:

1. Inspect existing routes
2. Inspect existing database schema
3. Search for reusable components
4. Generate minimal patch
5. Avoid unnecessary refactoring

Return:

* files modified
* files created
* migration requirements
* deployment steps
