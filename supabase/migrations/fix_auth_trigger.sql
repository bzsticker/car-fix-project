-- =========================================================================
-- Migration: fix_auth_trigger.sql
-- Description: Fix public.handle_new_user() trigger logic to prevent 
--              CHECK and Foreign Key constraint violations on public.profiles.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role VARCHAR(50);
    default_branch UUID;
BEGIN
    -- Extract role from metadata
    default_role := NEW.raw_user_meta_data ->> 'role';
    
    IF default_role IS NULL OR default_role = '' THEN
        -- Rule 1: If role metadata is missing, default to owner with no branch
        default_role := 'owner';
        default_branch := NULL;
    ELSE
        -- Try to extract branch_id from metadata if role is specified
        BEGIN
            default_branch := (NEW.raw_user_meta_data ->> 'branch_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            default_branch := NULL;
        END;
        
        -- Sanitize role and apply strict constraints
        IF default_role NOT IN ('owner', 'admin', 'technician') THEN
            -- Invalid role, fallback to owner and NULL to stay safe
            default_role := 'owner';
            default_branch := NULL;
        ELSIF default_role = 'owner' THEN
            -- Owners must never have a branch_id associated
            default_branch := NULL;
        ELSIF default_role IN ('admin', 'technician') THEN
            -- Verify if the provided branch_id exists in public.branches to avoid FK violations
            IF default_branch IS NOT NULL THEN
                IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = default_branch) THEN
                    default_branch := NULL;
                END IF;
            END IF;
            
            -- Rule 2: If branch_id is missing or invalid, assign first available branch
            IF default_branch IS NULL THEN
                SELECT id INTO default_branch FROM public.branches ORDER BY created_at ASC LIMIT 1;
                
                -- Fallback: If public.branches is empty, downgrade to owner to prevent CHECK violation
                IF default_branch IS NULL THEN
                    default_role := 'owner';
                END IF;
            END IF;
        END IF;
    END IF;
    
    -- Insert or update secure profile record
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
