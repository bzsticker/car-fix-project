import type { ApiSupabaseClient } from "./auth";

type CustomerScopeRow = {
  id: string;
  branch_id: string;
  full_name?: string;
  phone?: string;
  email?: string | null;
};

type VehicleScopeRow = {
  id: string;
  customer_id: string;
  license_plate: string;
  province: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vin: string | null;
  customer: CustomerScopeRow | CustomerScopeRow[] | null;
};

type JobScopeRow = {
  id: string;
  branch_id: string;
  car_id: string;
  customer_id: string;
  status: string;
  notes: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  created_by: string;
};

import { firstRelation } from "./relations";

export async function getCustomerScope(supabase: ApiSupabaseClient, customerId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("id, branch_id, full_name, phone, email")
    .eq("id", customerId)
    .is("deleted_at", null)
    .single<CustomerScopeRow>();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getVehicleScope(supabase: ApiSupabaseClient, vehicleId: string) {
  const { data, error } = await supabase
    .from("cars")
    .select("id, customer_id, license_plate, province, make, model, year, color, vin, customer:customers(id, branch_id, full_name, phone, email)")
    .eq("id", vehicleId)
    .is("deleted_at", null)
    .single<VehicleScopeRow>();

  if (error || !data) {
    return null;
  }

  const customer = firstRelation(data.customer);
  if (!customer) {
    return null;
  }

  return {
    ...data,
    customer,
  };
}

export async function getJobScope(supabase: ApiSupabaseClient, jobId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, branch_id, car_id, customer_id, status, notes, scheduled_start, scheduled_end, actual_start, actual_end, total_amount, created_at, updated_at, created_by")
    .eq("id", jobId)
    .is("deleted_at", null)
    .single<JobScopeRow>();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function isTechnicianAssignedToJob(
  supabase: ApiSupabaseClient,
  jobId: string,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("job_assignments")
    .select("id")
    .eq("job_id", jobId)
    .eq("profile_id", profileId)
    .maybeSingle<{ id: string }>();

  return !error && Boolean(data);
}
