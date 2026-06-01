import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { firstRelation } from "@/lib/api/relations";
import { getJobScope, isTechnicianAssignedToJob } from "@/lib/api/resources";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

const jobImageSchema = z.object({
  image_url: z.url(),
  image_type: z.enum(["before", "in_progress", "after", "qc_fail"]),
  description: z.string().max(5000).nullable().optional(),
});

type JobImageRow = {
  id: string;
  job_id: string;
  image_url: string;
  image_type: string;
  description: string | null;
  uploaded_by: string;
  created_at: string;
  uploader: { id: string; full_name: string; role: string } | { id: string; full_name: string; role: string }[] | null;
};

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
  const job = await getJobScope(supabase, id);

  if (!job) {
    return apiError(404, "ERR_NOT_FOUND", "Job not found");
  }

  if (!canReadBranch(profile, job.branch_id)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const { data, error } = await supabase
    .from("job_images")
    .select("id, job_id, image_url, image_type, description, uploaded_by, created_at, uploader:profiles(id, full_name, role)")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return apiError(500, "ERR_INTERNAL", error.message);
  }

  return apiSuccess(
    ((data ?? []) as JobImageRow[]).map((image) => {
      const uploader = firstRelation(image.uploader);

      return {
        id: image.id,
        job_id: image.job_id,
        image_url: image.image_url,
        image_type: image.image_type,
        description: image.description,
        uploaded_by: image.uploaded_by,
        created_at: image.created_at,
        uploader: uploader
          ? {
              id: uploader.id,
              full_name: uploader.full_name,
              role: uploader.role,
            }
          : null,
      };
    }),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await params;
  const { profile, supabase, user } = auth;
  const job = await getJobScope(supabase, id);

  if (!job) {
    return apiError(404, "ERR_NOT_FOUND", "Job not found");
  }

  if (!canReadBranch(profile, job.branch_id)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  if (profile.role === "technician") {
    const isAssigned = await isTechnicianAssignedToJob(supabase, id, profile.id);
    if (!isAssigned) {
      return apiError(403, "ERR_FORBIDDEN", "Technician is not assigned to this job");
    }
  }

  try {
    const body = await request.json();
    const result = jobImageSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { data, error } = await supabase
      .from("job_images")
      .insert({
        job_id: id,
        image_url: result.data.image_url,
        image_type: result.data.image_type,
        description: result.data.description ?? null,
        uploaded_by: user.id,
      })
      .select("id, job_id, image_url, image_type, description, uploaded_by, created_at")
      .single();

    if (error || !data) {
      return apiError(500, "ERR_INTERNAL", error?.message ?? "Job image upload failed");
    }

    await writeAuditLog({
      supabase,
      request,
      profileId: user.id,
      action: "INSERT",
      tableName: "job_images",
      recordId: data.id,
      newValues: data,
    });

    return apiSuccess(data, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
