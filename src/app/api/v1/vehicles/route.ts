import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { getCustomerScope } from "@/lib/api/resources";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiPaginated, apiSuccess } from "@/lib/api/response";

const vehicleSchema = z.object({
  customer_id: z.uuid(),
  license_plate: z.string().min(1).max(20),
  province: z.string().min(1).max(100),
  make: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2),
  color: z.string().min(1).max(50),
  vin: z.string().max(50).nullable().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const requestedBranchId = searchParams.get("filter_branch_id");
  const requestedCustomerId = searchParams.get("customer_id");

  if (requestedBranchId && !canReadBranch(profile, requestedBranchId)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  if (requestedCustomerId) {
    const customerScope = await getCustomerScope(supabase, requestedCustomerId);

    if (!customerScope) {
      return apiError(404, "ERR_NOT_FOUND", "Customer not found");
    }

    if (!canReadBranch(profile, customerScope.branch_id)) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
    }
  }

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const offset = (safePage - 1) * safeLimit;

  let query = supabase
    .from("cars")
    .select("*, customer:customers(id, branch_id, full_name)", { count: "exact" })
    .is("deleted_at", null);

  if (requestedBranchId) {
    query = query.eq("customers.branch_id", requestedBranchId);
  } else if (profile.role !== "owner" && profile.branch_id) {
    query = query.eq("customers.branch_id", profile.branch_id);
  }

  if (requestedCustomerId) {
    query = query.eq("customer_id", requestedCustomerId);
  }

  if (search) {
    const escapedSearch = search.replace(/[%_,]/g, "\\$&");
    query = query.or(
      `license_plate.ilike.%${escapedSearch}%,vin.ilike.%${escapedSearch}%,make.ilike.%${escapedSearch}%,model.ilike.%${escapedSearch}%`,
    );
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + safeLimit - 1);

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

  const { profile, supabase } = auth;

  try {
    const body = await request.json();
    const result = vehicleSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, branch_id")
      .eq("id", result.data.customer_id)
      .is("deleted_at", null)
      .single<{ id: string; branch_id: string }>();

    if (customerError || !customer) {
      return apiError(404, "ERR_NOT_FOUND", "Customer not found");
    }

    if (profile.role === "admin" && profile.branch_id !== customer.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Customer belongs to another branch");
    }

    const { data: vehicle, error: insertError } = await supabase
      .from("cars")
      .insert({
        customer_id: result.data.customer_id,
        license_plate: result.data.license_plate,
        province: result.data.province,
        make: result.data.make,
        model: result.data.model,
        year: result.data.year,
        color: result.data.color,
        vin: result.data.vin || null,
      })
      .select("*, customer:customers(full_name)")
      .single();

    if (insertError || !vehicle) {
      return apiError(500, "ERR_INTERNAL", insertError?.message ?? "Vehicle creation failed");
    }

    return apiSuccess(vehicle, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
