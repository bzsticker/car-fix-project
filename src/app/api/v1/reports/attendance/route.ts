import { type NextRequest } from "next/server";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  // 1. Authenticate user (Only Owner and Admin allowed)
  const authContext = await requireApiAuth(["owner", "admin"]);
  if ("response" in authContext) {
    return authContext.response;
  }

  const { supabase, profile } = authContext;

  try {
    const { searchParams } = new URL(request.url);
    const start_date = searchParams.get("start_date") || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const end_date = searchParams.get("end_date") || new Date().toISOString();
    
    // Apply branch isolation
    let branch_id = searchParams.get("branch_id") || "";
    if (profile.role === "admin") {
      branch_id = profile.branch_id || "";
    }

    // 2. Query attendance logs
    let query = supabase
      .from("attendance_logs")
      .select(`
        id,
        profile_id,
        branch_id,
        clock_in,
        clock_out,
        status,
        latitude,
        longitude,
        selfie_url,
        notes,
        created_at,
        employee:profiles!attendance_logs_profile_id_fkey(full_name, email)
      `)
      .gte("clock_in", start_date)
      .lte("clock_in", end_date)
      .order("clock_in", { ascending: false });

    if (branch_id) {
      query = query.eq("branch_id", branch_id);
    }

    const { data: logs, error: queryError } = await query;

    if (queryError || !logs) {
      return apiError(
        500,
        "ERR_INTERNAL",
        `Failed to retrieve attendance logs: ${queryError?.message}`
      );
    }

    // Format nested profile relations
    const formattedLogs = logs.map((log: {
      id: string;
      profile_id: string;
      branch_id: string | null;
      clock_in: string;
      clock_out: string | null;
      status: string;
      latitude: number | null;
      longitude: number | null;
      selfie_url: string | null;
      notes: string | null;
      created_at: string;
      employee: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
    }) => ({
      ...log,
      employee: Array.isArray(log.employee) ? log.employee[0] : log.employee,
    }));

    // 3. Compute aggregations
    const total_shifts = formattedLogs.length;
    let on_time_shifts = 0;
    let late_shifts = 0;
    let active_shifts = 0;
    let total_hours_worked = 0;
    let completed_shifts = 0;

    for (const log of formattedLogs) {
      if (log.status === "on_time") {
        on_time_shifts++;
      } else if (log.status === "late") {
        late_shifts++;
      }

      if (!log.clock_out) {
        active_shifts++;
      } else {
        completed_shifts++;
        const durationMs = new Date(log.clock_out).getTime() - new Date(log.clock_in).getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        total_hours_worked += durationHours;
      }
    }

    const avg_hours_worked = completed_shifts > 0 ? parseFloat((total_hours_worked / completed_shifts).toFixed(2)) : 0;
    const late_rate = total_shifts > 0 ? parseFloat(((late_shifts / total_shifts) * 100).toFixed(2)) : 0;

    return apiSuccess({
      success: true,
      data: {
        summary: {
          total_shifts,
          on_time_shifts,
          late_shifts,
          active_shifts,
          late_rate,
          total_hours_worked: parseFloat(total_hours_worked.toFixed(2)),
          avg_hours_worked,
        },
        logs: formattedLogs,
      },
    });
  } catch (err) {
    return apiError(
      500,
      "ERR_INTERNAL",
      err instanceof Error ? err.message : "Failed to compile attendance report"
    );
  }
}
