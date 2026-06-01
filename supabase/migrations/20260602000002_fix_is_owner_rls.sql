-- =========================================================================
-- Migration: 20260602000002_fix_is_owner_rls.sql
-- Description: Updates public.is_owner() helper function to check the
--              public.profiles table as a fallback. This resolves issues
--              where JWT user_metadata does not have the role synced.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'owner' OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
              AND role = 'owner' 
              AND is_active = true 
              AND deleted_at IS NULL
        ),
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
