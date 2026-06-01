import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

const assignmentSchema = z.object({
  profile_id: z.uuid(),
  assigned_role: z.enum(["lead_technician", "assistant_technician"]),
});

type JobRow = { id: string; branch_id: string };
type TechnicianRow = { id: string; branch_id: string | null; role: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await params;
  const { profile, supabase } = auth;

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, branch_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single<JobRow>();

  if (jobError || !job) {
    return apiError(404, "ERR_NOT_FOUND", "Job not found");
  }

  if (profile.role !== "owner" && profile.branch_id !== job.branch_id) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const { data, error } = await supabase
    .from("job_assignments")
    .select("id, assigned_role, assigned_at, profile:profiles(id, full_name, role)")
    .eq("job_id", id);

  if (error) {
    return apiError(500, "ERR_INTERNAL", error.message);
  }

  return apiSuccess(data ?? []);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await params;
  const { profile, supabase } = auth;

  try {
    const body = await request.json();
    const result = assignmentSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, branch_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single<JobRow>();

    if (jobError || !job) {
      return apiError(404, "ERR_NOT_FOUND", "Job not found");
    }

    if (profile.role === "admin" && profile.branch_id !== job.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Job belongs to another branch");
    }

    const { data: technician, error: techError } = await supabase
      .from("profiles")
      .select("id, branch_id, role")
      .eq("id", result.data.profile_id)
      .is("deleted_at", null)
      .single<TechnicianRow>();

    if (techError || !technician || technician.role !== "technician") {
      return apiError(404, "ERR_NOT_FOUND", "Technician not found");
    }

    if (technician.branch_id !== job.branch_id) {
      return apiError(422, "ERR_VALIDATION", "Technician belongs to a different branch");
    }

    const { data, error } = await supabase
      .from("job_assignments")
      .insert({
        job_id: id,
        profile_id: result.data.profile_id,
        assigned_role: result.data.assigned_role,
      })
      .select("id, assigned_role, assigned_at, profile:profiles(id, full_name, role)")
      .single();

    if (error || !data) {
      return apiError(500, "ERR_INTERNAL", error?.message ?? "Assignment creation failed");
    }

    return apiSuccess(data, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
