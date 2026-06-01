import { requireApiAuth } from "@/lib/api/auth";
import { getVehicleScope } from "@/lib/api/resources";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

type JobHistoryRow = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
};

type QuoteHistoryRow = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  valid_until: string;
};

type WarrantyHistoryRow = {
  id: string;
  warranty_code: string;
  status: string;
  start_date: string;
  end_date: string;
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
  const vehicleScope = await getVehicleScope(supabase, id);

  if (!vehicleScope) {
    return apiError(404, "ERR_NOT_FOUND", "Vehicle not found");
  }

  if (!canReadBranch(profile, vehicleScope.customer.branch_id)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const [{ data: jobs, error: jobsError }, { data: quotes, error: quotesError }, { data: warranties, error: warrantiesError }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("id, status, total_amount, created_at")
        .eq("car_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("quotes")
        .select("id, status, total_amount, created_at, valid_until")
        .eq("car_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("warranties")
        .select("id, warranty_code, status, start_date, end_date")
        .eq("car_id", id)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("start_date", { ascending: false }),
    ]);

  if (jobsError || quotesError || warrantiesError) {
    return apiError(
      500,
      "ERR_INTERNAL",
      jobsError?.message ?? quotesError?.message ?? warrantiesError?.message ?? "Failed to load vehicle history",
    );
  }

  return apiSuccess({
    vehicle_id: id,
    jobs: (jobs ?? []) as JobHistoryRow[],
    quotes: (quotes ?? []) as QuoteHistoryRow[],
    warranties: (warranties ?? []) as WarrantyHistoryRow[],
  });
}
