import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";

const clockInSchema = z.object({
  branch_id: z.string().uuid(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  selfie_url: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  // 1. Authenticate user session
  const authContext = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in authContext) {
    return authContext.response;
  }

  const { supabase, profile } = authContext;

  try {
    const body = await request.json();
    const parsed = clockInSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        400,
        "ERR_BAD_REQUEST",
        "Invalid clock-in inputs",
        parsed.error.flatten()
      );
    }

    const { branch_id, latitude, longitude, selfie_url, notes } = parsed.data;

    // 2. Check if already clocked in (where clock_out IS NULL)
    const { data: activeLog, error: activeError } = await supabase
      .from("attendance_logs")
      .select("id")
      .eq("profile_id", profile.id)
      .is("clock_out", null)
      .maybeSingle();

    if (activeError) {
      return apiError(
        500,
        "ERR_INTERNAL",
        `Failed to verify active attendance log: ${activeError.message}`
      );
    }

    if (activeLog) {
      return apiError(
        400,
        "ERR_BAD_REQUEST",
        "You already have an active shift clock-in record. Please clock out first."
      );
    }

    // 3. Determine status ('on_time' vs 'late')
    // We assume standard shift starts at 08:30 AM Asia/Bangkok
    const now = new Date();
    const bangkokTimeStr = now.toLocaleTimeString("en-US", {
      timeZone: "Asia/Bangkok",
      hour12: false,
    });
    const [hours, minutes] = bangkokTimeStr.split(":").map(Number);
    
    let status: "on_time" | "late" = "on_time";
    if (hours && (hours > 8 || (hours === 8 && minutes && minutes > 30))) {
      status = "late";
    }

    // 4. Create attendance log
    const { data: newLog, error: createError } = await supabase
      .from("attendance_logs")
      .insert({
        profile_id: profile.id,
        branch_id,
        clock_in: now.toISOString(),
        clock_out: null,
        status,
        latitude: latitude || null,
        longitude: longitude || null,
        selfie_url: selfie_url || null,
        notes: notes || null,
      })
      .select("*")
      .single();

    if (createError || !newLog) {
      return apiError(
        500,
        "ERR_INTERNAL",
        `Failed to write shift clock-in registry: ${createError?.message}`
      );
    }

    // 5. Write audit trail log
    await writeAuditLog({
      supabase,
      request,
      profileId: profile.id,
      action: "clock_in",
      tableName: "attendance_logs",
      recordId: newLog.id,
      newValues: {
        clock_in: newLog.clock_in,
        status,
      },
    });

    return apiSuccess({
      success: true,
      data: newLog,
    });
  } catch (err) {
    return apiError(
      500,
      "ERR_INTERNAL",
      err instanceof Error ? err.message : "Failed to record clock-in shift log"
    );
  }
}
