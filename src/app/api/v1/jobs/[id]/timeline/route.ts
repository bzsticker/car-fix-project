import { requireApiAuth } from "@/lib/api/auth";
import { firstRelation } from "@/lib/api/relations";
import { getJobScope } from "@/lib/api/resources";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

type TimelineItem = {
  timestamp: string;
  type: string;
  operator: string | null;
  description: string;
  payload?: Record<string, unknown>;
};

type AssignmentTimelineRow = {
  profile_id: string;
  assigned_role: string;
  assigned_at: string;
  profile: { full_name: string } | { full_name: string }[] | null;
};

type ServiceTimelineRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  technician: { full_name: string } | { full_name: string }[] | null;
};

type PartTimelineRow = {
  id: string;
  quantity: number;
  total_price: number;
  created_at: string;
  inventory: {
    product: { sku: string; name: string } | { sku: string; name: string }[] | null;
  } | {
    product: { sku: string; name: string } | { sku: string; name: string }[] | null;
  }[] | null;
};

type ImageTimelineRow = {
  id: string;
  image_url: string;
  image_type: string;
  description: string | null;
  created_at: string;
  uploader: { full_name: string } | { full_name: string }[] | null;
};

type AuditTimelineRow = {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  created_at: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  profile: { full_name: string } | { full_name: string }[] | null;
};

type CreatorRow = {
  full_name: string;
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

  const [
    { data: creator },
    { data: assignments, error: assignmentsError },
    { data: services, error: servicesError },
    { data: parts, error: partsError },
    { data: images, error: imagesError },
    { data: auditLogs, error: auditLogsError },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", job.created_by).single<CreatorRow>(),
    supabase
      .from("job_assignments")
      .select("profile_id, assigned_role, assigned_at, profile:profiles(full_name)")
      .eq("job_id", id)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("job_services")
      .select("id, name, status, created_at, updated_at, technician:profiles(full_name)")
      .eq("job_id", id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("job_parts")
      .select("id, quantity, total_price, created_at, inventory:inventories(product:products(sku, name))")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("job_images")
      .select("id, image_url, image_type, description, created_at, uploader:profiles(full_name)")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("id, action, table_name, record_id, created_at, old_values, new_values, profile:profiles(full_name)")
      .in("table_name", ["jobs", "job_images"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (assignmentsError || servicesError || partsError || imagesError || auditLogsError) {
    return apiError(
      500,
      "ERR_INTERNAL",
      assignmentsError?.message ??
        servicesError?.message ??
        partsError?.message ??
        imagesError?.message ??
        auditLogsError?.message ??
        "Failed to load job timeline",
    );
  }

  const timeline: TimelineItem[] = [
    {
      timestamp: job.created_at,
      type: "job_created",
      operator: creator?.full_name ?? null,
      description: `Job ${job.id} created with status ${job.status.replaceAll("_", " ")}`,
    },
  ];

  for (const assignment of (assignments ?? []) as AssignmentTimelineRow[]) {
    const operator = firstRelation(assignment.profile);
    timeline.push({
      timestamp: assignment.assigned_at,
      type: "technician_assigned",
      operator: operator?.full_name ?? null,
      description: `${operator?.full_name ?? "Technician"} assigned as ${assignment.assigned_role.replaceAll("_", " ")}`,
    });
  }

  for (const service of (services ?? []) as ServiceTimelineRow[]) {
    const technician = firstRelation(service.technician);
    timeline.push({
      timestamp: service.updated_at,
      type: "service_status",
      operator: technician?.full_name ?? null,
      description: `Service ${service.name} is ${service.status.replaceAll("_", " ")}`,
      payload: {
        service_id: service.id,
      },
    });
  }

  for (const part of (parts ?? []) as PartTimelineRow[]) {
    const inventory = firstRelation(part.inventory);
    const product = firstRelation(inventory?.product ?? null);
    timeline.push({
      timestamp: part.created_at,
      type: "part_consumed",
      operator: null,
      description: `Consumed ${part.quantity} x ${product?.name ?? product?.sku ?? "Unknown Part"}`,
      payload: {
        part_id: part.id,
        total_price: part.total_price,
      },
    });
  }

  for (const image of (images ?? []) as ImageTimelineRow[]) {
    const uploader = firstRelation(image.uploader);
    timeline.push({
      timestamp: image.created_at,
      type: "photo_upload",
      operator: uploader?.full_name ?? null,
      description: `Progress photo uploaded (image_type: ${image.image_type})`,
      payload: {
        image_id: image.id,
        image_url: image.image_url,
        description: image.description,
      },
    });
  }

  for (const auditLog of (auditLogs ?? []) as AuditTimelineRow[]) {
    const relatedJobId =
      (auditLog.new_values?.job_id as string | undefined) ??
      (auditLog.old_values?.job_id as string | undefined) ??
      (auditLog.record_id === id ? id : undefined);

    if (relatedJobId !== id) {
      continue;
    }

    const operator = firstRelation(auditLog.profile);
    if (auditLog.table_name === "jobs" && auditLog.action === "UPDATE") {
      timeline.push({
        timestamp: auditLog.created_at,
        type: "job_updated",
        operator: operator?.full_name ?? null,
        description: "Job details updated",
        payload: {
          old_values: auditLog.old_values,
          new_values: auditLog.new_values,
        },
      });
    }

    if (auditLog.table_name === "job_images" && auditLog.action === "DELETE") {
      timeline.push({
        timestamp: auditLog.created_at,
        type: "photo_deleted",
        operator: operator?.full_name ?? null,
        description: "Progress photo deleted",
        payload: {
          old_values: auditLog.old_values,
        },
      });
    }
  }

  timeline.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));

  return apiSuccess({
    job_id: id,
    timeline,
  });
}
