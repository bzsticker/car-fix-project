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
  const filterStatus = searchParams.get("filter_status");
  const search = searchParams.get("search")?.trim() ?? "";

  if (requestedBranchId && !canReadBranch(profile, requestedBranchId)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const offset = (safePage - 1) * safeLimit;

  let query = supabase
    .from("invoices")
    .select("*, customer:customers(id, full_name, phone)", { count: "exact" })
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

  // Search filter
  if (search) {
    const escapedSearch = search.replace(/[%_,]/g, "\\$&");
    query = query.or(`invoice_number.ilike.%${escapedSearch}%`);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + safeLimit - 1);

  if (error) {
    return apiError(500, "ERR_INTERNAL", error.message);
  }

  interface InvoiceRow {
    [key: string]: unknown;
    customer?: unknown;
  }

  // Safe relation extract
  const formatted = (data as unknown as InvoiceRow[] ?? []).map((row) => ({
    ...row,
    customer: Array.isArray(row.customer) ? row.customer[0] : row.customer,
  }));

  return apiPaginated(formatted, {
    page: safePage,
    limit: safeLimit,
    total_records: count ?? 0,
    total_pages: Math.ceil((count ?? 0) / safeLimit),
  });
}
