-- =========================================================================
-- Rollback Migration: 20260602000001_fix_profiles_roles_rollback.sql
-- Description: Reverts profiles to role='owner' and branch_id=NULL, 
--              and restores the previous defensive handle_new_user() trigger.
-- =========================================================================

-- 1. Revert existing profiles back to role='owner' and branch_id=NULL
UPDATE public.profiles
SET role = 'owner', branch_id = NULL;

-- 2. Restore previous defensive handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role VARCHAR(50);
    default_branch UUID;
BEGIN
    default_role := NEW.raw_user_meta_data ->> 'role';
    
    IF default_role IS NULL OR default_role = '' THEN
        default_role := 'owner';
        default_branch := NULL;
    ELSE
        BEGIN
            default_branch := (NEW.raw_user_meta_data ->> 'branch_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            default_branch := NULL;
        END;
        
        IF default_role NOT IN ('owner', 'admin', 'technician') THEN
            default_role := 'owner';
            default_branch := NULL;
        ELSIF default_role = 'owner' THEN
            default_branch := NULL;
        ELSIF default_role IN ('admin', 'technician') THEN
            IF default_branch IS NOT NULL THEN
                IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = default_branch) THEN
                    default_branch := NULL;
                END IF;
            END IF;
            
            IF default_branch IS NULL THEN
                SELECT id INTO default_branch FROM public.branches ORDER BY created_at ASC LIMIT 1;
                
                IF default_branch IS NULL THEN
                    default_role := 'owner';
                END IF;
            END IF;
        END IF;
    END IF;
    
    INSERT INTO public.profiles (id, email, full_name, role, branch_id, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        default_role,
        default_branch,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        branch_id = EXCLUDED.branch_id,
        is_active = EXCLUDED.is_active,
        updated_at = now();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
