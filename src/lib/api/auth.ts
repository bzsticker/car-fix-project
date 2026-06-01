import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import { type ApiProfile, type AppRole, hasRole } from "./rbac";
import { apiError } from "./response";

export type ApiSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type AuthSuccess = {
  profile: ApiProfile;
  supabase: ApiSupabaseClient;
  user: User;
};

type AuthFailure = {
  response: Response;
};

export type AuthContext = AuthSuccess | AuthFailure;

export async function requireApiAuth(allowedRoles?: readonly AppRole[]): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: apiError(401, "ERR_UNAUTHORIZED", "Unauthorized access"),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, branch_id")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single<ApiProfile>();

  if (profileError || !profile) {
    return {
      response: apiError(403, "ERR_FORBIDDEN", "Profile access is not available"),
    };
  }

  if (allowedRoles && !hasRole(profile.role, allowedRoles)) {
    return {
      response: apiError(403, "ERR_FORBIDDEN", "Insufficient permissions"),
    };
  }

  return { profile, supabase, user };
}
