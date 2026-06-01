import { requireApiAuth } from "@/lib/api/auth";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const requestedBranchId = searchParams.get("filter_branch_id");

  // 1. Branch Isolation Validation
  let branchId = profile.branch_id;
  if (profile.role === "owner") {
    branchId = requestedBranchId || null;
  } else if (requestedBranchId && !canReadBranch(profile, requestedBranchId)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  try {
    // 1. Query all active warranties
    let wrQuery = supabase
      .from("warranties")
      .select("id, status, customer:customers!inner(branch_id)")
      .is("deleted_at", null);

    // 2. Query warranty claims
    let clQuery = supabase
      .from("warranty_claims")
      .select("id, status, warranty:warranties!inner(id, customer:customers!inner(branch_id))");

    if (branchId) {
      wrQuery = wrQuery.eq("customer.branch_id", branchId);
      clQuery = clQuery.eq("warranty.customer.branch_id", branchId);
    }

    const [wrRes, clRes] = await Promise.all([wrQuery, clQuery]);

    if (wrRes.error) return apiError(500, "ERR_INTERNAL", wrRes.error.message);
    if (clRes.error) return apiError(500, "ERR_INTERNAL", clRes.error.message);

    const warranties = wrRes.data ?? [];
    const claims = clRes.data ?? [];

    const claimStatusCounts = claims.reduce((acc: Record<string, number>, claim) => {
      acc[claim.status] = (acc[claim.status] || 0) + 1;
      return acc;
    }, {});

    const totalWarranties = warranties.length;
    const totalClaims = claims.length;
    const defectRatePercent = totalWarranties > 0 ? (totalClaims / totalWarranties) * 100 : 0;

    return apiSuccess({
      branch_id: branchId ?? "all_branches",
      total_warranties_count: totalWarranties,
      total_claims_count: totalClaims,
      defect_rate_percent: defectRatePercent,
      claims_by_status: claimStatusCounts,
    });
  } catch (err) {
    return apiError(500, "ERR_INTERNAL", err instanceof Error ? err.message : "Failed to load warranty reports");
  }
}
