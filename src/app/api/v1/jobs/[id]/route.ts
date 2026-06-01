import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { firstRelation } from "@/lib/api/relations";
import { getJobScope, isTechnicianAssignedToJob } from "@/lib/api/resources";
import { canReadBranch, canWriteBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

const allowedJobStatuses = [
  "draft",
  "pending_approval",
  "scheduled",
  "in_progress",
  "awaiting_parts",
  "qc",
  "ready_for_pickup",
  "completed",
  "cancelled",
] as const;

const allowedTechnicianStatuses = ["scheduled", "in_progress", "qc", "ready_for_pickup", "completed"] as const;

const jobUpdateSchema = z
  .object({
    status: z.enum(allowedJobStatuses).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    scheduled_start: z.string().datetime().nullable().optional(),
    scheduled_end: z.string().datetime().nullable().optional(),
    actual_start: z.string().datetime().nullable().optional(),
    actual_end: z.string().datetime().nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    "At least one field is required",
  );

type JobDetailRow = {
  id: string;
  branch_id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  created_at: string;
  updated_at: string;
  car: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
  } | {
    id: string;
    license_plate: string;
    make: string;
    model: string;
  }[] | null;
  customer: {
    id: string;
    full_name: string;
  } | {
    id: string;
    full_name: string;
  }[] | null;
};

type JobServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  status: string;
  assigned_technician_id: string | null;
  updated_at: string;
};

type JobPartRow = {
  id: string;
  quantity: number;
  total_price: number;
  inventory: {
    product: {
      sku: string;
      name: string;
    } | {
      sku: string;
      name: string;
    }[] | null;
  } | {
    product: {
      sku: string;
      name: string;
    } | {
      sku: string;
      name: string;
    }[] | null;
  }[] | null;
};

type JobAssignmentRow = {
  profile_id: string;
  assigned_role: string;
  profile: {
    full_name: string;
  } | {
    full_name: string;
  }[] | null;
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
  const jobScope = await getJobScope(supabase, id);

  if (!jobScope) {
    return apiError(404, "ERR_NOT_FOUND", "Job not found");
  }

  if (!canReadBranch(profile, jobScope.branch_id)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const [
    { data: job, error: jobError },
    { data: services, error: servicesError },
    { data: parts, error: partsError },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, branch_id, status, total_amount, notes, scheduled_start, scheduled_end, actual_start, actual_end, created_at, updated_at, car:cars(id, license_plate, make, model), customer:customers(id, full_name)")
      .eq("id", id)
      .is("deleted_at", null)
      .single<JobDetailRow>(),
    supabase
      .from("job_services")
      .select("id, name, description, price, status, assigned_technician_id, updated_at")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("job_parts")
      .select("id, quantity, total_price, inventory:inventories(product:products(sku, name))")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("job_assignments")
      .select("profile_id, assigned_role, profile:profiles(full_name)")
      .eq("job_id", id)
      .order("assigned_at", { ascending: true }),
  ]);

  if (jobError || !job || servicesError || partsError || assignmentsError) {
    return apiError(
      500,
      "ERR_INTERNAL",
      jobError?.message ?? servicesError?.message ?? partsError?.message ?? assignmentsError?.message ?? "Failed to load job detail",
    );
  }

  const car = firstRelation(job.car);
  const customer = firstRelation(job.customer);

  return apiSuccess({
    id: job.id,
    branch_id: job.branch_id,
    status: job.status,
    total_amount: job.total_amount,
    notes: job.notes,
    scheduled_start: job.scheduled_start,
    scheduled_end: job.scheduled_end,
    actual_start: job.actual_start,
    actual_end: job.actual_end,
    created_at: job.created_at,
    updated_at: job.updated_at,
    car: car
      ? {
          id: car.id,
          license_plate: car.license_plate,
          make: car.make,
          model: car.model,
        }
      : null,
    customer: customer
      ? {
          id: customer.id,
          full_name: customer.full_name,
        }
      : null,
    services: ((services ?? []) as JobServiceRow[]).map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price,
      status: service.status,
      assigned_technician_id: service.assigned_technician_id,
      updated_at: service.updated_at,
    })),
    parts: ((parts ?? []) as JobPartRow[]).map((part) => {
      const inventory = firstRelation(part.inventory);
      const product = firstRelation(inventory?.product ?? null);

      return {
        id: part.id,
        sku: product?.sku ?? null,
        product_name: product?.name ?? null,
        quantity: part.quantity,
        total_price: part.total_price,
      };
    }),
    assignments: ((assignments ?? []) as JobAssignmentRow[]).map((assignment) => {
      const operator = firstRelation(assignment.profile);

      return {
        profile_id: assignment.profile_id,
        full_name: operator?.full_name ?? null,
        assigned_role: assignment.assigned_role,
      };
    }),
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await params;
  const { profile, supabase, user } = auth;
  const jobScope = await getJobScope(supabase, id);

  if (!jobScope) {
    return apiError(404, "ERR_NOT_FOUND", "Job not found");
  }

  if (!canReadBranch(profile, jobScope.branch_id)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  try {
    const body = await request.json();
    const result = jobUpdateSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    if (profile.role === "technician") {
      const isAssigned = await isTechnicianAssignedToJob(supabase, id, profile.id);
      if (!isAssigned) {
        return apiError(403, "ERR_FORBIDDEN", "Technician is not assigned to this job");
      }

      if (
        result.data.status &&
        !allowedTechnicianStatuses.includes(result.data.status as (typeof allowedTechnicianStatuses)[number])
      ) {
        return apiError(403, "ERR_FORBIDDEN", "Technicians cannot set this job status");
      }

      const requestedKeys = Object.keys(result.data).filter((key) => result.data[key as keyof typeof result.data] !== undefined);
      if (requestedKeys.some((key) => key !== "status")) {
        return apiError(403, "ERR_FORBIDDEN", "Technicians can only update job status");
      }
    } else if (!canWriteBranch(profile, jobScope.branch_id)) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
    }

    const updatePayload = {
      ...(result.data.status !== undefined ? { status: result.data.status } : {}),
      ...(result.data.notes !== undefined ? { notes: result.data.notes } : {}),
      ...(result.data.scheduled_start !== undefined ? { scheduled_start: result.data.scheduled_start } : {}),
      ...(result.data.scheduled_end !== undefined ? { scheduled_end: result.data.scheduled_end } : {}),
      ...(result.data.actual_start !== undefined ? { actual_start: result.data.actual_start } : {}),
      ...(result.data.actual_end !== undefined ? { actual_end: result.data.actual_end } : {}),
    };

    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update(updatePayload)
      .eq("id", id)
      .select("id, branch_id, car_id, customer_id, status, notes, scheduled_start, scheduled_end, actual_start, actual_end, total_amount, created_at, updated_at, created_by")
      .single();

    if (updateError || !updatedJob) {
      return apiError(500, "ERR_INTERNAL", updateError?.message ?? "Job update failed");
    }

    await writeAuditLog({
      supabase,
      request,
      profileId: user.id,
      action: "UPDATE",
      tableName: "jobs",
      recordId: id,
      oldValues: jobScope,
      newValues: updatedJob,
    });

    return apiSuccess(updatedJob);
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
