import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiPaginated, apiSuccess } from "@/lib/api/response";

const createProductSchema = z.object({
  sku: z.string().min(3, "SKU must be at least 3 characters").max(100),
  barcode: z.string().max(100).nullable().optional(),
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  description: z.string().nullable().optional(),
  category: z.enum(["wraps", "exhausts", "coatings", "bodykits", "accessories", "labor"]),
  unit_price: z.number().nonnegative("Unit price must be positive or zero"),
  retail_price: z.number().nonnegative("Retail price must be positive or zero"),
});

export async function GET(request: Request) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { supabase } = auth;
  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const search = searchParams.get("search")?.trim() ?? "";
  const category = searchParams.get("category");

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const offset = (safePage - 1) * safeLimit;

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .is("deleted_at", null);

  // Search filter
  if (search) {
    const escapedSearch = search.replace(/[%_,]/g, "\\$&");
    query = query.or(`sku.ilike.%${escapedSearch}%,name.ilike.%${escapedSearch}%`);
  }

  // Category filter
  if (category) {
    query = query.eq("category", category);
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
  // Only owners can modify the central master catalog
  const auth = await requireApiAuth(["owner"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { supabase, user } = auth;

  try {
    const body = await request.json();
    const result = createProductSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { sku, barcode, name, description, category, unit_price, retail_price } = result.data;

    // Check for SKU duplicate
    const { data: existingSku } = await supabase
      .from("products")
      .select("id")
      .eq("sku", sku)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingSku) {
      return apiError(422, "ERR_VALIDATION", `Product with SKU "${sku}" already exists`);
    }

    // Check for Barcode duplicate if provided
    if (barcode) {
      const { data: existingBarcode } = await supabase
        .from("products")
        .select("id")
        .eq("barcode", barcode)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingBarcode) {
        return apiError(422, "ERR_VALIDATION", `Product with Barcode "${barcode}" already exists`);
      }
    }

    // Insert Product in master catalog
    const { data: product, error: insertError } = await supabase
      .from("products")
      .insert({
        sku,
        barcode: barcode || null,
        name,
        description: description || null,
        category,
        unit_price,
        retail_price,
      })
      .select()
      .single();

    if (insertError || !product) {
      return apiError(500, "ERR_INTERNAL", insertError?.message ?? "Failed to create catalog product");
    }

    // Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "INSERT",
      table_name: "products",
      record_id: product.id,
      new_values: product,
    });

    return apiSuccess(product, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
