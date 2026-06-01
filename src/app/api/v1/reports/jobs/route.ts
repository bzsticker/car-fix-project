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
  const startDateStr = searchParams.get("start_date");
  const endDateStr = searchParams.get("end_date");

  // 1. Branch Isolation Validation
  let branchId = profile.branch_id;
  if (profile.role === "owner") {
    branchId = requestedBranchId || null;
  } else if (requestedBranchId && !canReadBranch(profile, requestedBranchId)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  try {
    let query = supabase
      .from("jobs")
      .select("id, status, scheduled_start, scheduled_end, actual_start, actual_end, created_at")
      .is("deleted_at", null);

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }
    if (startDateStr) {
      query = query.gte("created_at", startDateStr);
    }
    if (endDateStr) {
      query = query.lte("created_at", endDateStr);
    }

    const { data: jobs, error } = await query;
    if (error) return apiError(500, "ERR_INTERNAL", error.message);

    const activeJobs = jobs ?? [];

    // Count jobs by status
    const statusCounts = activeJobs.reduce((acc: Record<string, number>, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    // Compute average duration for completed jobs (in minutes)
    let completedCount = 0;
    let totalMinutes = 0;

    for (const job of activeJobs) {
      if (job.status === "completed" && job.actual_start && job.actual_end) {
        const start = new Date(job.actual_start).getTime();
        const end = new Date(job.actual_end).getTime();
        const durationMin = (end - start) / (1000 * 60);
        if (durationMin > 0) {
          totalMinutes += durationMin;
          completedCount++;
        }
      }
    }

    const avgDurationMinutes = completedCount > 0 ? Math.round(totalMinutes / completedCount) : 0;

    return apiSuccess({
      branch_id: branchId ?? "all_branches",
      total_jobs: activeJobs.length,
      by_status: statusCounts,
      completed_jobs_count: completedCount,
      average_job_duration_minutes: avgDurationMinutes,
    });
  } catch (err) {
    return apiError(500, "ERR_INTERNAL", err instanceof Error ? err.message : "Failed to load job metrics");
  }
}
