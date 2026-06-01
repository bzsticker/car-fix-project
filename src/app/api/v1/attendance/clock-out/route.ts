import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";

const clockOutSchema = z.object({
  notes: z.string().optional().nullable(),
});

export async function PUT(request: NextRequest) {
  // 1. Authenticate user session
  const authContext = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in authContext) {
    return authContext.response;
  }

  const { supabase, profile } = authContext;

  try {
    const body = await request.json();
    const parsed = clockOutSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        400,
        "ERR_BAD_REQUEST",
        "Invalid clock-out inputs",
        parsed.error.flatten()
      );
    }

    const { notes } = parsed.data;

    // 2. Fetch the active attendance log (where clock_out IS NULL)
    const { data: activeLog, error: fetchError } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("profile_id", profile.id)
      .is("clock_out", null)
      .maybeSingle();

    if (fetchError) {
      return apiError(
        500,
        "ERR_INTERNAL",
        `Failed to retrieve active clock-in log: ${fetchError.message}`
      );
    }

    if (!activeLog) {
      return apiError(
        400,
        "ERR_BAD_REQUEST",
        "No active shift clock-in record found for your account. You must clock in first."
      );
    }

    // 3. Update the log with clock_out timestamp
    const now = new Date();
    const updatedNotes = notes 
      ? (activeLog.notes ? `${activeLog.notes} | ${notes}` : notes)
      : activeLog.notes;

    const { data: updatedLog, error: updateError } = await supabase
      .from("attendance_logs")
      .update({
        clock_out: now.toISOString(),
        notes: updatedNotes || null,
      })
      .eq("id", activeLog.id)
      .select("*")
      .single();

    if (updateError || !updatedLog) {
      return apiError(
        500,
        "ERR_INTERNAL",
        `Failed to close shift clock-out log: ${updateError?.message}`
      );
    }

    // 4. Write audit log
    await writeAuditLog({
      supabase,
      request,
      profileId: profile.id,
      action: "clock_out",
      tableName: "attendance_logs",
      recordId: updatedLog.id,
      newValues: {
        clock_out: updatedLog.clock_out,
      },
    });

    return apiSuccess({
      success: true,
      data: updatedLog,
    });
  } catch (err) {
    return apiError(
      500,
      "ERR_INTERNAL",
      err instanceof Error ? err.message : "Failed to record clock-out shift log"
    );
  }
}
