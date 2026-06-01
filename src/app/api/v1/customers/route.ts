import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { canReadBranch, resolveWriteBranch } from "@/lib/api/rbac";
import { apiError, apiPaginated, apiSuccess } from "@/lib/api/response";

const customerSchema = z.object({
  branch_id: z.uuid().optional(),
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+?[0-9\-]{9,15}$/, "Invalid phone number format"),
  email: z.string().email("Invalid email format").nullable().or(z.literal("")),
  line_user_id: z.string().nullable().optional(),
});

const allowedSortFields = new Set(["created_at", "full_name"]);

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
  const sortByParam = searchParams.get("sort_by") ?? "created_at";
  const sortDirParam = searchParams.get("sort_dir") ?? "desc";
  const sortBy = allowedSortFields.has(sortByParam) ? sortByParam : "created_at";
  const ascending = sortDirParam === "asc";

  if (requestedBranchId && !canReadBranch(profile, requestedBranchId)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const offset = (safePage - 1) * safeLimit;

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .is("deleted_at", null);

  if (requestedBranchId) {
    query = query.eq("branch_id", requestedBranchId);
  } else if (profile.role !== "owner" && profile.branch_id) {
    query = query.eq("branch_id", profile.branch_id);
  }

  if (search) {
    const escapedSearch = search.replace(/[%_,]/g, "\\$&");
    query = query.or(
      `full_name.ilike.%${escapedSearch}%,phone.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%`,
    );
  }

  const { data, count, error } = await query
    .order(sortBy, { ascending })
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

  const { profile, supabase, user } = auth;

  try {
    const body = await request.json();
    const result = customerSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const branchId = resolveWriteBranch(profile, result.data.branch_id);
    if (!branchId) {
      return apiError(400, "ERR_BAD_REQUEST", "branch_id is required");
    }

    const { data: customer, error: insertError } = await supabase
      .from("customers")
      .insert({
        branch_id: branchId,
        full_name: result.data.full_name,
        phone: result.data.phone,
        email: result.data.email || null,
        line_user_id: result.data.line_user_id || null,
      })
      .select()
      .single();

    if (insertError || !customer) {
      return apiError(500, "ERR_INTERNAL", insertError?.message ?? "Customer creation failed");
    }

    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "INSERT",
      table_name: "customers",
      record_id: customer.id,
      new_values: customer,
    });

    return apiSuccess(customer, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
