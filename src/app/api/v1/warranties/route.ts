import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiPaginated, apiSuccess } from "@/lib/api/response";

const registerWarrantySchema = z.object({
  customer_id: z.string().uuid("Customer ID must be a valid UUID"),
  car_id: z.string().uuid("Car ID must be a valid UUID"),
  job_id: z.string().uuid("Job ID must be a valid UUID").nullable().optional(),
  product_id: z.string().uuid("Product ID must be a valid UUID"),
  duration_months: z.number().int().positive("Duration must be a positive number of months").default(12),
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
  const search = searchParams.get("search")?.trim() ?? "";
  const filterStatus = searchParams.get("filter_status");

  // 1. Branch Isolation Rls validation
  if (requestedBranchId && !canReadBranch(profile, requestedBranchId)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const offset = (safePage - 1) * safeLimit;

  // Query warranties joined with customer, vehicle, and product details
  // Filter by inner join on customer to enforce branch isolation
  let query = supabase
    .from("warranties")
    .select("*, customer:customers!inner(id, full_name, phone, branch_id), car:cars(*), product:products(*)", { count: "exact" })
    .is("deleted_at", null);

  // 2. Enforce Branch Isolation
  if (profile.role !== "owner" && profile.branch_id) {
    query = query.eq("customer.branch_id", profile.branch_id);
  } else if (profile.role === "owner" && requestedBranchId) {
    query = query.eq("customer.branch_id", requestedBranchId);
  }

  // 3. Status filter
  if (filterStatus) {
    query = query.eq("status", filterStatus);
  }

  // 4. Search Filter (by warranty code or customer name)
  if (search) {
    const escapedSearch = search.replace(/[%_,]/g, "\\$&");
    query = query.or(
      `warranty_code.ilike.%${escapedSearch}%,full_name.ilike.%${escapedSearch}%`,
      { foreignTable: "customer" }
    );
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + safeLimit - 1);

  if (error) {
    return apiError(500, "ERR_INTERNAL", error.message);
  }

  interface WarrantyRow {
    [key: string]: unknown;
    customer?: unknown;
    car?: unknown;
    product?: unknown;
  }

  const formatted = (data as unknown as WarrantyRow[] ?? []).map((row) => ({
    ...row,
    customer: Array.isArray(row.customer) ? row.customer[0] : row.customer,
    car: Array.isArray(row.car) ? row.car[0] : row.car,
    product: Array.isArray(row.product) ? row.product[0] : row.product,
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
    const result = registerWarrantySchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { customer_id, car_id, job_id, product_id, duration_months } = result.data;

    // 1. Fetch customer to verify branch isolation
    const { data: customer, error: custError } = await supabase
      .from("customers")
      .select("id, branch_id, full_name")
      .eq("id", customer_id)
      .is("deleted_at", null)
      .single();

    if (custError || !customer) {
      return apiError(404, "ERR_NOT_FOUND", "Customer profile not found");
    }

    // Enforce branch isolation
    if (profile.role === "admin" && customer.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden to register warranty for customer in another branch");
    }

    // 2. Fetch vehicle to verify relation
    const { data: car, error: carError } = await supabase
      .from("cars")
      .select("id, license_plate")
      .eq("id", car_id)
      .eq("customer_id", customer_id)
      .is("deleted_at", null)
      .single();

    if (carError || !car) {
      return apiError(404, "ERR_NOT_FOUND", "Vehicle not found or does not belong to the selected customer");
    }

    // 3. Fetch product details
    const { data: product, error: prodError } = await supabase
      .from("products")
      .select("sku")
      .eq("id", product_id)
      .is("deleted_at", null)
      .single();

    if (prodError || !product) {
      return apiError(404, "ERR_NOT_FOUND", "Catalog product model not found");
    }

    // 4. Generate unique warranty code WRY-<SKU>-<PLATE>-<RANDOM_HEX_4>
    const skuPrefix = product.sku.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
    const plateClean = car.license_plate.replace(/[^a-zA-Z0-9ก-ฮ]/g, "").slice(0, 8).toUpperCase();
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
    const warrantyCode = `WRY-${skuPrefix}-${plateClean}-${randomHex}`;

    // 5. Calculate start and end date
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(startDate.getMonth() + duration_months);

    // 6. Insert warranty record
    const { data: warranty, error: insertError } = await supabase
      .from("warranties")
      .insert({
        customer_id,
        car_id,
        job_id: job_id || null,
        product_id,
        warranty_code: warrantyCode,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: "active",
      })
      .select()
      .single();

    if (insertError || !warranty) {
      return apiError(500, "ERR_INTERNAL", insertError?.message ?? "Failed to create warranty sheet");
    }

    // 7. Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "INSERT",
      table_name: "warranties",
      record_id: warranty.id,
      new_values: warranty,
    });

    return apiSuccess(warranty, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON request body");
  }
}
