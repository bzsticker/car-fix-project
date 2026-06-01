import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

const transitionClaimSchema = z.object({
  status: z.enum(["approved", "rejected", "completed"]),
  resolution_notes: z.string().min(5, "Resolution notes must be at least 5 characters"),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;
  const { id: claimId } = await params;

  try {
    const body = await request.json();
    const result = transitionClaimSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { status, resolution_notes } = result.data;

    // 1. Fetch current warranty claim joined with customer branch data
    const { data: claim, error: fetchError } = await supabase
      .from("warranty_claims")
      .select("*, warranty:warranties(id, customer:customers(id, branch_id))")
      .eq("id", claimId)
      .single();

    if (fetchError || !claim) {
      return apiError(404, "ERR_NOT_FOUND", "Warranty claim record not found");
    }

    interface ClaimRow {
      id: string;
      status: string;
      warranty: {
        customer: {
          branch_id: string;
        } | null;
      } | null;
    }

    const row = claim as unknown as ClaimRow;

    // 2. Enforce Branch Isolation
    if (profile.role === "admin" && row.warranty?.customer?.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden to resolve claims belonging to another branch");
    }

    // 3. Optional: State machine checks
    if (row.status === "completed" && status !== "completed") {
      return apiError(422, "ERR_VALIDATION", "Cannot modify state of a finalized completed claim");
    }

    // 4. Update Claim Status
    const { data: updatedClaim, error: updateError } = await supabase
      .from("warranty_claims")
      .update({
        status,
        resolution_notes,
        resolved_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)
      .select()
      .single();

    if (updateError || !updatedClaim) {
      return apiError(500, "ERR_INTERNAL", updateError?.message ?? "Failed to update claim workflow status");
    }

    // 5. Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "UPDATE",
      table_name: "warranty_claims",
      record_id: claimId,
      old_values: {
        status: row.status,
      },
      new_values: updatedClaim,
    });

    return apiSuccess(updatedClaim);
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON request payload");
  }
}
