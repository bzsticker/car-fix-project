-- =========================================================================
-- Rollback Migration: 20260602000002_fix_is_owner_rls_rollback.sql
-- Description: Restores public.is_owner() helper function to check only
--              the JWT user_metadata, undoing the profiles table fallback.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'owner',
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
