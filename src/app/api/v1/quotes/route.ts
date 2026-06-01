import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiPaginated, apiSuccess } from "@/lib/api/response";

const quoteItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().int().positive("Quantity must be greater than zero"),
  unit_price: z.number().nonnegative("Unit price must be positive"),
  item_type: z.enum(["service", "part"]),
});

const quoteSchema = z.object({
  branch_id: z.uuid().optional(),
  customer_id: z.uuid(),
  car_id: z.uuid(),
  valid_until: z.string().datetime("Invalid date format"),
  items: z.array(quoteItemSchema).min(1, "At least one item is required in quote"),
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
    .from("quotes")
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
    .order("created_at", { ascending: false })
    .range(offset, offset + safeLimit - 1);

  if (error) {
    return apiError(500, "ERR_INTERNAL", error.message);
  }

  interface QuoteRow {
    [key: string]: unknown;
    customer?: unknown;
    car?: unknown;
  }

  // Safe relation extract
  const formatted = (data as unknown as QuoteRow[] ?? []).map((row) => ({
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
    const result = quoteSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    // Resolve Branch ID: Owner can select, Admin is locked to own branch
    const branchId = profile.role === "owner" ? result.data.branch_id : profile.branch_id;
    if (!branchId) {
      return apiError(400, "ERR_BAD_REQUEST", "branch_id is required");
    }

    // Check Customer profile exists and belongs to branch
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

    // Check Vehicle exists
    const { data: car, error: carError } = await supabase
      .from("cars")
      .select("id, customer_id")
      .eq("id", result.data.car_id)
      .is("deleted_at", null)
      .single<{ id: string; customer_id: string }>();

    if (carError || !car) {
      return apiError(404, "ERR_NOT_FOUND", "Vehicle registry not found");
    }

    if (car.customer_id !== customer.id) {
      return apiError(422, "ERR_VALIDATION", "Vehicle does not belong to selected customer");
    }

    // Calculate total amount
    const totalAmount = result.data.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0,
    );

    // Insert Quote
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        branch_id: branchId,
        customer_id: result.data.customer_id,
        car_id: result.data.car_id,
        status: "draft",
        valid_until: result.data.valid_until,
        total_amount: totalAmount,
      })
      .select()
      .single<{ id: string; total_amount: number }>();

    if (quoteError || !quote) {
      return apiError(500, "ERR_INTERNAL", quoteError?.message ?? "Failed to create Quotation");
    }

    // Insert Quote Items
    const itemsToInsert = result.data.items.map((item) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      item_type: item.item_type,
    }));

    const { error: itemsError } = await supabase
      .from("quote_items")
      .insert(itemsToInsert);

    if (itemsError) {
      // Cleanup quote on item failure to preserve consistency
      await supabase.from("quotes").delete().eq("id", quote.id);
      return apiError(500, "ERR_INTERNAL", itemsError.message);
    }

    // Fetch complete nested object for return
    const { data: completeQuote } = await supabase
      .from("quotes")
      .select("*, customer:customers(id, full_name, phone), car:cars(id, license_plate, make, model), items:quote_items(*)")
      .eq("id", quote.id)
      .single();

    // Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "INSERT",
      table_name: "quotes",
      record_id: quote.id,
      new_values: completeQuote,
    });

    return apiSuccess(completeQuote, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
