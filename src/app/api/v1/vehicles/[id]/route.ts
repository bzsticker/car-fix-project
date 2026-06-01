import { requireApiAuth } from "@/lib/api/auth";
import { firstRelation } from "@/lib/api/relations";
import { getVehicleScope } from "@/lib/api/resources";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

type VehicleDetailRow = {
  id: string;
  customer_id: string;
  license_plate: string;
  province: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vin: string | null;
  customer: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
  } | {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
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
  const vehicleScope = await getVehicleScope(supabase, id);

  if (!vehicleScope) {
    return apiError(404, "ERR_NOT_FOUND", "Vehicle not found");
  }

  if (!canReadBranch(profile, vehicleScope.customer.branch_id)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const { data: vehicle, error } = await supabase
    .from("cars")
    .select("id, customer_id, license_plate, province, make, model, year, color, vin, customer:customers(id, full_name, phone, email)")
    .eq("id", id)
    .is("deleted_at", null)
    .single<VehicleDetailRow>();

  if (error || !vehicle) {
    return apiError(404, "ERR_NOT_FOUND", "Vehicle not found");
  }

  const customer = firstRelation(vehicle.customer);
  if (!customer) {
    return apiError(404, "ERR_NOT_FOUND", "Vehicle owner not found");
  }

  return apiSuccess({
    id: vehicle.id,
    license_plate: vehicle.license_plate,
    province: vehicle.province,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color,
    vin: vehicle.vin,
    customer: {
      id: customer.id,
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email,
    },
  });
}
