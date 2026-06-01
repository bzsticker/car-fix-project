import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase } = auth;
  const { id } = await params;

  try {
    // Fetch target warranty with nested customer, vehicle, product, job, and claims details
    const { data: warranty, error } = await supabase
      .from("warranties")
      .select("*, customer:customers(*), car:cars(*), product:products(*), job:jobs(*), claims:warranty_claims(*, resolver:profiles(full_name))")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !warranty) {
      return apiError(404, "ERR_NOT_FOUND", "Warranty registry profile not found");
    }

    interface WarrantyRow {
      [key: string]: unknown;
      customer: {
        id: string;
        branch_id: string;
      };
      claims?: unknown;
    }

    const row = warranty as unknown as WarrantyRow;

    // Enforce Branch Isolation
    if (profile.role !== "owner" && profile.branch_id && row.customer.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden to view details of a warranty belonging to another branch");
    }

    interface ClaimRowItem {
      [key: string]: unknown;
      resolver?: unknown;
    }

    // Format relation array if returned as array in PostgREST
    const formattedClaims = (Array.isArray(row.claims) ? row.claims : [row.claims]).filter(Boolean).map((claim: unknown) => {
      const c = claim as ClaimRowItem;
      return {
        ...c,
        resolver: Array.isArray(c.resolver) ? c.resolver[0] : c.resolver,
      };
    });

    const formatted = {
      ...row,
      claims: formattedClaims,
    };

    return apiSuccess(formatted);
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed request parameter ID");
  }
}
