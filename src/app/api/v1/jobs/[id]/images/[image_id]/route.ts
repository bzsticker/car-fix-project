import { requireApiAuth } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { getJobScope } from "@/lib/api/resources";
import { canReadBranch, canWriteBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

type JobImageDeleteRow = {
  id: string;
  job_id: string;
  image_url: string;
  image_type: string;
  description: string | null;
  uploaded_by: string;
  created_at: string;
};

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; image_id: string }> },
) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { id, image_id: imageId } = await params;
  const { profile, supabase, user } = auth;
  const job = await getJobScope(supabase, id);

  if (!job) {
    return apiError(404, "ERR_NOT_FOUND", "Job not found");
  }

  if (!canReadBranch(profile, job.branch_id)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const { data: image, error: imageError } = await supabase
    .from("job_images")
    .select("id, job_id, image_url, image_type, description, uploaded_by, created_at")
    .eq("id", imageId)
    .eq("job_id", id)
    .single<JobImageDeleteRow>();

  if (imageError || !image) {
    return apiError(404, "ERR_NOT_FOUND", "Job image not found");
  }

  if (profile.role === "technician") {
    if (image.uploaded_by !== profile.id) {
      return apiError(403, "ERR_FORBIDDEN", "Technician can only delete their own images");
    }
  } else if (!canWriteBranch(profile, job.branch_id)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const { error: deleteError } = await supabase
    .from("job_images")
    .delete()
    .eq("id", imageId)
    .eq("job_id", id);

  if (deleteError) {
    return apiError(500, "ERR_INTERNAL", deleteError.message);
  }

  await writeAuditLog({
    supabase,
    request,
    profileId: user.id,
    action: "DELETE",
    tableName: "job_images",
    recordId: image.id,
    oldValues: image,
  });

  return apiSuccess({
    success: true,
    image_id: image.id,
  });
}
