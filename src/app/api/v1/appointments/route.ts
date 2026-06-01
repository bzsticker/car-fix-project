import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiPaginated, apiSuccess } from "@/lib/api/response";

const appointmentSchema = z.object({
  branch_id: z.uuid().optional(),
  customer_id: z.uuid(),
  car_id: z.uuid().nullable().optional(),
  appointment_date: z.string().datetime("Invalid appointment date format"),
  service_type: z.enum(["wrap", "ceramic", "exhaust", "general_checkup"]),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const requestedBranchId = searchParams.get("filter_branch_id");
  const filterStatus = searchParams.get("filter_status");

  if (requestedBranchId && !canReadBranch(profile, requestedBranchId)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const offset = (safePage - 1) * safeLimit;

  let query = supabase
    .from("appointments")
    .select("*, customer:customers(id, full_name, phone), car:cars(id, license_plate, make, model)", { count: "exact" })
    .is("deleted_at", null);

  // Branch Isolation
  if (profile.role !== "owner" && profile.branch_id) {
    query = query.eq("branch_id", profile.branch_id);
  } else if (profile.role === "owner" && requestedBranchId) {
    query = query.eq("branch_id", requestedBranchId);
  }

  // Filter status
  if (filterStatus) {
    query = query.eq("status", filterStatus);
  }

  const { data, count, error } = await query
    .order("appointment_date", { ascending: true })
    .range(offset, offset + safeLimit - 1);

  if (error) {
    return apiError(500, "ERR_INTERNAL", error.message);
  }

interface AppointmentRow {
  [key: string]: unknown;
  customer?: unknown;
  car?: unknown;
}

  // Handle relation array wrapper format by extracting first item safely
  const formatted = (data as unknown as AppointmentRow[] ?? []).map((row) => ({
    ...row,
    customer: Array.isArray(row.customer) ? row.customer[0] : row.customer,
    car: Array.isArray(row.car) ? row.car[0] : row.car,
  }));

  return apiPaginated(formatted, {
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
    const result = appointmentSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    // Resolve Branch ID: Owner can select branch, Admin is locked to own branch
    const branchId = profile.role === "owner" ? result.data.branch_id : profile.branch_id;
    if (!branchId) {
      return apiError(400, "ERR_BAD_REQUEST", "branch_id is required");
    }

    // Check customer exists and belongs to correct branch if admin
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, branch_id")
      .eq("id", result.data.customer_id)
      .is("deleted_at", null)
      .single<{ id: string; branch_id: string }>();

    if (customerError || !customer) {
      return apiError(404, "ERR_NOT_FOUND", "Customer profile not found");
    }

    if (profile.role === "admin" && customer.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Customer belongs to another branch");
    }

    // Insert Appointment
    const { data: appointment, error: insertError } = await supabase
      .from("appointments")
      .insert({
        branch_id: branchId,
        customer_id: result.data.customer_id,
        car_id: result.data.car_id || null,
        appointment_date: result.data.appointment_date,
        service_type: result.data.service_type,
        notes: result.data.notes || null,
        status: "pending",
      })
      .select("*, customer:customers(id, full_name, phone), car:cars(id, license_plate, make, model)")
      .single();

    if (insertError || !appointment) {
      return apiError(500, "ERR_INTERNAL", insertError?.message ?? "Failed to register appointment");
    }

    // Safe relation extract
    const formatted = {
      ...appointment,
      customer: Array.isArray(appointment.customer) ? appointment.customer[0] : appointment.customer,
      car: Array.isArray(appointment.car) ? appointment.car[0] : appointment.car,
    };

    // Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "INSERT",
      table_name: "appointments",
      record_id: formatted.id,
      new_values: formatted,
    });

    return apiSuccess(formatted, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
