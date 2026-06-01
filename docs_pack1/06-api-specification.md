# API Specification

Complete production-grade RESTful API Specifications for the **Den Modify Management System** have been fully designed and documented to **V3**.

Please refer to the primary API specifications file:
- [api-specification-v3.md](file:///d:/AI%20LERNING/Car%20Fix%20project/docs/api-specification-v3.md)

## Spec V3 Highlights

1. **Global REST Standards**: Standardized paginated structures, detailed HSL error structures, and strict JSON format parameters.
2. **Error Code Registry**: Centralized listing of application-specific codes (e.g. low inventory, validation fails).
3. **Exhaustive REST Endpoints Covered**: Meticulous documentation of JSON schemas, types, required fields, and role-based permissions (Owner, Admin, Technician) for all active operational modules, including **8 newly added endpoint blocks**:
   - Job Detail deeper lookups (`GET/PUT /api/v1/jobs/:id`).
   - Multi-technician Job Assignments team manager (`GET/POST/DELETE`).
   - Job Photos progress uploads and deletions (`GET/POST/DELETE`).
   - Chronological Job Timeline event streams (`GET /api/v1/jobs/:id/timeline`).
   - Customer Timeline transaction logs (`GET /api/v1/customers/:id/timeline`).
   - Vehicle detailed specs and modification history (`GET /api/v1/vehicles/:id`).
   - Warranty Claim Workflow status transition hooks (`PUT /api/v1/warranties/claims/:id/status`).
   - Granular Reports endpoints for revenue, inventory valuation, and employee attendance logs.
