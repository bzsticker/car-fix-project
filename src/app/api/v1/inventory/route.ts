import { requireApiAuth } from "@/lib/api/auth";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiPaginated } from "@/lib/api/response";

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

  // 1. RBAC & Branch Isolation Validation
  if (requestedBranchId && !canReadBranch(profile, requestedBranchId)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden to view inventory for another branch");
  }

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const offset = (safePage - 1) * safeLimit;

  // Query inventories with nested product details
  // Using products!inner to allow filtering by product attributes (SKU, Name)
  let query = supabase
    .from("inventories")
    .select("*, product:products!inner(*)", { count: "exact" })
    .is("deleted_at", null);

  // 2. Enforce Branch Isolation
  if (profile.role !== "owner" && profile.branch_id) {
    query = query.eq("branch_id", profile.branch_id);
  } else if (profile.role === "owner" && requestedBranchId) {
    query = query.eq("branch_id", requestedBranchId);
  }

  // 3. Search Filter
  if (search) {
    const escapedSearch = search.replace(/[%_,]/g, "\\$&");
    query = query.or(`sku.ilike.%${escapedSearch}%,name.ilike.%${escapedSearch}%`, { foreignTable: "products" });
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + safeLimit - 1);

  if (error) {
    return apiError(500, "ERR_INTERNAL", error.message);
  }

  interface InventoryRow {
    [key: string]: unknown;
    product?: unknown;
  }

  // Format relation array if returned as array
  const formatted = (data as unknown as InventoryRow[] ?? []).map((row) => ({
    ...row,
    product: Array.isArray(row.product) ? row.product[0] : row.product,
  }));

  return apiPaginated(formatted, {
    page: safePage,
    limit: safeLimit,
    total_records: count ?? 0,
    total_pages: Math.ceil((count ?? 0) / safeLimit),
  });
}
