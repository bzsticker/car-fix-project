import { requireApiAuth } from "@/lib/api/auth";
import { firstRelation } from "@/lib/api/relations";
import { getCustomerScope } from "@/lib/api/resources";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

type CustomerDetailRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  line_user_id: string | null;
  created_at: string;
  branch: {
    id: string;
    name: string;
  } | {
    id: string;
    name: string;
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
  const customerScope = await getCustomerScope(supabase, id);

  if (!customerScope) {
    return apiError(404, "ERR_NOT_FOUND", "Customer not found");
  }

  if (!canReadBranch(profile, customerScope.branch_id)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, email, line_user_id, created_at, branch:branches(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .single<CustomerDetailRow>();

  if (error || !customer) {
    return apiError(404, "ERR_NOT_FOUND", "Customer not found");
  }

  const branch = firstRelation(customer.branch);

  return apiSuccess({
    id: customer.id,
    full_name: customer.full_name,
    phone: customer.phone,
    email: customer.email,
    line_user_id: customer.line_user_id,
    created_at: customer.created_at,
    branch: branch
      ? {
          id: branch.id,
          name: branch.name,
        }
      : null,
  });
}
