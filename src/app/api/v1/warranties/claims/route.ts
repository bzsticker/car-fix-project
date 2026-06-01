import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

const submitClaimSchema = z.object({
  warranty_id: z.string().uuid("Warranty ID must be a valid UUID"),
  description: z.string().min(5, "Claim description must be at least 5 characters"),
  image_url: z.string().url("Image URL must be a valid HTTP/S link").nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;

  try {
    const body = await request.json();
    const result = submitClaimSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { warranty_id, description, image_url } = result.data;

    // 1. Fetch Warranty to verify existence, status, and branch
    const { data: warranty, error: fetchError } = await supabase
      .from("warranties")
      .select("id, status, customer:customers(id, branch_id)")
      .eq("id", warranty_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !warranty) {
      return apiError(404, "ERR_NOT_FOUND", "Active warranty registry not found");
    }

    interface WarrantyRow {
      status: string;
      customer: {
        id: string;
        branch_id: string;
      } | null;
    }

    const row = warranty as unknown as WarrantyRow;

    // 2. Enforce Branch Isolation
    if (profile.role !== "owner" && profile.branch_id && row.customer?.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden to file claim for a customer in another branch");
    }

    // 3. Prevent filing claims against void or expired warranties
    if (row.status !== "active") {
      return apiError(422, "ERR_VALIDATION", `Cannot submit defect claim. Current warranty status is "${row.status}"`);
    }

    // 4. Insert Warranty Claim
    const { data: claim, error: insertError } = await supabase
      .from("warranty_claims")
      .insert({
        warranty_id,
        description,
        image_url: image_url || null,
        status: "pending",
      })
      .select()
      .single();

    if (insertError || !claim) {
      return apiError(500, "ERR_INTERNAL", insertError?.message ?? "Failed to create warranty claim");
    }

    // 5. Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "INSERT",
      table_name: "warranty_claims",
      record_id: claim.id,
      new_values: claim,
    });

    return apiSuccess(claim, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON request payload");
  }
}
