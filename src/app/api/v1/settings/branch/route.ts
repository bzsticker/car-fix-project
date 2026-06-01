import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";

const updateBranchSettingsSchema = z.object({
  phone: z.string().min(8).max(50),
  address: z.string().min(5).max(500),
});

export async function GET() {
  // 1. Authenticate user
  const authContext = await requireApiAuth(["owner", "admin"]);
  if ("response" in authContext) {
    return authContext.response;
  }

  const { supabase, profile } = authContext;

  try {
    if (!profile.branch_id) {
      return apiError(
        400,
        "ERR_BAD_REQUEST",
        "Your account is not assigned to any branch settings profile."
      );
    }

    const { data: branch, error: fetchErr } = await supabase
      .from("branches")
      .select("id, name, phone, address, created_at, updated_at")
      .eq("id", profile.branch_id)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !branch) {
      return apiError(
        404,
        "ERR_NOT_FOUND",
        `Assigned branch record not found: ${fetchErr?.message}`
      );
    }

    return apiSuccess({
      success: true,
      data: branch,
    });
  } catch (err) {
    return apiError(
      500,
      "ERR_INTERNAL",
      err instanceof Error ? err.message : "Failed to load branch settings"
    );
  }
}

export async function PUT(request: NextRequest) {
  // 1. Authenticate user
  const authContext = await requireApiAuth(["owner", "admin"]);
  if ("response" in authContext) {
    return authContext.response;
  }

  const { supabase, profile } = authContext;

  try {
    if (!profile.branch_id) {
      return apiError(
        400,
        "ERR_BAD_REQUEST",
        "Your account is not assigned to any branch settings profile."
      );
    }

    const body = await request.json();
    const parsed = updateBranchSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        400,
        "ERR_BAD_REQUEST",
        "Invalid settings inputs",
        parsed.error.flatten()
      );
    }

    const { phone, address } = parsed.data;

    // Fetch old details for audit
    const { data: oldBranch } = await supabase
      .from("branches")
      .select("phone, address")
      .eq("id", profile.branch_id)
      .single();

    // 2. Update branch info
    const { data: updatedBranch, error: updateErr } = await supabase
      .from("branches")
      .update({
        phone,
        address,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.branch_id)
      .select("id, name, phone, address, created_at, updated_at")
      .single();

    if (updateErr || !updatedBranch) {
      return apiError(
        500,
        "ERR_INTERNAL",
        `Failed to update branch settings profile: ${updateErr?.message}`
      );
    }

    // 3. Write audit log
    await writeAuditLog({
      supabase,
      request,
      profileId: profile.id,
      action: "update_branch_settings",
      tableName: "branches",
      recordId: updatedBranch.id,
      oldValues: oldBranch,
      newValues: {
        phone: updatedBranch.phone,
        address: updatedBranch.address,
      },
    });

    return apiSuccess({
      success: true,
      data: updatedBranch,
    });
  } catch (err) {
    return apiError(
      500,
      "ERR_INTERNAL",
      err instanceof Error ? err.message : "Failed to record branch settings modifications"
    );
  }
}
