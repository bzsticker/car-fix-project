export type AppRole = "owner" | "admin" | "technician";

export interface ApiProfile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  branch_id: string | null;
}

export function hasRole(role: AppRole, allowedRoles: readonly AppRole[]) {
  return allowedRoles.includes(role);
}

export function canReadBranch(profile: ApiProfile, branchId: string) {
  return profile.role === "owner" || profile.branch_id === branchId;
}

export function canWriteBranch(profile: ApiProfile, branchId: string) {
  return profile.role === "owner" || (profile.role === "admin" && profile.branch_id === branchId);
}

export function resolveWriteBranch(
  profile: ApiProfile,
  requestedBranchId?: string | null,
) {
  if (profile.role === "owner") {
    return requestedBranchId ?? null;
  }

  if (profile.role === "admin") {
    return profile.branch_id;
  }

  return null;
}
