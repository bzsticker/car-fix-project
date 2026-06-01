import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiPaginated, apiSuccess } from "@/lib/api/response";

const jobSchema = z.object({
  branch_id: z.uuid().optional(),
  customer_id: z.uuid(),
  car_id: z.uuid(),
  scheduled_start: z.string().datetime().nullable().optional(),
  scheduled_end: z.string().datetime().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

type CustomerRow = { id: string; branch_id: string };
type CarRow = { id: string; customer_id: string };

export async function GET(request: Request) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const filterStatus = searchParams.get("filter_status");
  const assignedTechId = searchParams.get("assigned_tech_id");

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const offset = (safePage - 1) * safeLimit;

  let query = supabase
    .from("jobs")
    .select(
      "*, car:cars(id, license_plate, make, model), customer:customers(id, full_name), assignments:job_assignments(profile_id, assigned_role)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (profile.role !== "owner" && profile.branch_id) {
    query = query.eq("branch_id", profile.branch_id);
  }

  if (filterStatus) {
    query = query.eq("status", filterStatus);
  }

  if (assignedTechId) {
    query = query.eq("job_assignments.profile_id", assignedTechId);
  }

  const { data, count, error } = await query.range(offset, offset + safeLimit - 1);

  if (error) {
    return apiError(500, "ERR_INTERNAL", error.message);
  }

  return apiPaginated(data ?? [], {
    page: safePage,
    limit: safeLimit,
    total_records: count ?? 0,
    total_pages: Math.ceil((count ?? 0) / safeLimit),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;

  try {
    const body = await request.json();
    const result = jobSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, branch_id")
      .eq("id", result.data.customer_id)
      .is("deleted_at", null)
      .single<CustomerRow>();

    if (customerError || !customer) {
      return apiError(404, "ERR_NOT_FOUND", "Customer not found");
    }

    const { data: car, error: carError } = await supabase
      .from("cars")
      .select("id, customer_id")
      .eq("id", result.data.car_id)
      .is("deleted_at", null)
      .single<CarRow>();

    if (carError || !car) {
      return apiError(404, "ERR_NOT_FOUND", "Vehicle not found");
    }

    if (car.customer_id !== customer.id) {
      return apiError(422, "ERR_VALIDATION", "Vehicle does not belong to the selected customer");
    }

    const branchId = profile.role === "owner" ? result.data.branch_id ?? customer.branch_id : profile.branch_id;
    if (!branchId) {
      return apiError(400, "ERR_BAD_REQUEST", "branch_id is required");
    }

    if (profile.role === "admin" && branchId !== customer.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Customer belongs to another branch");
    }

    if (branchId !== customer.branch_id) {
      return apiError(422, "ERR_VALIDATION", "branch_id does not match the customer branch");
    }

    const { data: job, error: insertError } = await supabase
      .from("jobs")
      .insert({
        branch_id: branchId,
        car_id: result.data.car_id,
        customer_id: result.data.customer_id,
        status: "draft",
        created_by: user.id,
        scheduled_start: result.data.scheduled_start ?? null,
        scheduled_end: result.data.scheduled_end ?? null,
        notes: result.data.notes ?? null,
      })
      .select("*, car:cars(license_plate, make, model), customer:customers(full_name)")
      .single();

    if (insertError || !job) {
      return apiError(500, "ERR_INTERNAL", insertError?.message ?? "Job creation failed");
    }

    return apiSuccess(job, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
