# SQL Migrations - Refactored

The production-ready PostgreSQL database migrations have been fully refactored, containing 22 tables, check constraints, automatic audit trigger functions, an immutable stock movements ledger, and comprehensive seed data.

- **Primary Migration File**: [20260601000000_init_schema.sql](file:///d:/AI%20LERNING/Car%20Fix%20project/supabase/migrations/20260601000000_init_schema.sql)
- **Detailed Schema Documentation**: [database-schema.md](file:///d:/AI%20LERNING/Car%20Fix%20project/docs/database-schema.md)

## Migration Execution Rules

1. **Local Development**:
   - Run `supabase start` to start the local Docker container.
   - Run `supabase db reset` to clean, migrate, and automatically seed all test branches, product catalog, inventories, attendance, and team-based job assignments.

2. **Staging / Production**:
   - Run `supabase db push` to securely apply migrations to remote branches.
