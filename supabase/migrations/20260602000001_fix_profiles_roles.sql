-- =========================================================================
-- Migration: 20260602000001_fix_profiles_roles.sql
-- Description: Corrects roles and branch assignments for existing profiles and 
--              updates handle_new_user() trigger to enforce strict constraints.
--              Uses real Production Branch UUIDs:
--              - '1c61a46f-72c1-497a-b601-b7780f98e767' (สำนักงานใหญ่ - ระยอง)
--              - 'ff2c3c35-55d6-4d9e-a01d-db907ce25d41' (สาขา 2 - ระยอง)
-- =========================================================================

-- 1. Correct existing profiles by email to assign correct role and branch_id
UPDATE public.profiles
SET role = 'owner', branch_id = NULL
WHERE email = 'owner@denmodify.com';

UPDATE public.profiles
SET role = 'admin', branch_id = '1c61a46f-72c1-497a-b601-b7780f98e767'
WHERE email = 'admin1@denmodify.com';

UPDATE public.profiles
SET role = 'admin', branch_id = 'ff2c3c35-55d6-4d9e-a01d-db907ce25d41'
WHERE email = 'admin2@denmodify.com';

UPDATE public.profiles
SET role = 'technician', branch_id = '1c61a46f-72c1-497a-b601-b7780f98e767'
WHERE email = 'tech1@denmodify.com';

UPDATE public.profiles
SET role = 'technician', branch_id = '1c61a46f-72c1-497a-b601-b7780f98e767'
WHERE email = 'tech2@denmodify.com';

UPDATE public.profiles
SET role = 'technician', branch_id = 'ff2c3c35-55d6-4d9e-a01d-db907ce25d41'
WHERE email = 'tech3@denmodify.com';

UPDATE public.profiles
SET role = 'technician', branch_id = 'ff2c3c35-55d6-4d9e-a01d-db907ce25d41'
WHERE email = 'tech4@denmodify.com';

-- 2. Update handle_new_user() trigger function to enforce role/branch constraints
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role VARCHAR(50);
    default_branch UUID;
BEGIN
    -- Extract and sanitize role from metadata (defaulting safely to 'owner' if missing)
    default_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'owner');
    
    -- Reject invalid roles outright to prevent check constraint violations
    IF default_role NOT IN ('owner', 'admin', 'technician') THEN
        RAISE EXCEPTION 'Invalid role specified: %. Allowed roles are: owner, admin, technician.', default_role;
    END IF;
    
    -- Extract branch_id from metadata
    BEGIN
        default_branch := (NEW.raw_user_meta_data ->> 'branch_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
        default_branch := NULL;
    END;
    
    -- Enforce strict role and branch associations
    IF default_role = 'owner' THEN
        -- Owner users get role='owner' and branch_id=NULL
        default_branch := NULL;
    ELSIF default_role IN ('admin', 'technician') THEN
        -- Admin and Technician require valid branch_id
        IF default_branch IS NULL THEN
            RAISE EXCEPTION 'branch_id is required for role %', default_role;
        END IF;
        
        -- Verify if the provided branch_id exists in the branches table
        IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = default_branch) THEN
            RAISE EXCEPTION 'Invalid branch_id %: Branch does not exist in database', default_branch;
        END IF;
    END IF;
    
    -- Insert or update profile record
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
