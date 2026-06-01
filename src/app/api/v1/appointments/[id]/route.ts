import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

const appointmentUpdateSchema = z.object({
  appointment_date: z.string().datetime().optional(),
  service_type: z.enum(["wrap", "ceramic", "exhaust", "general_checkup"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed_to_job"]).optional(),
});

type ContextType = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: ContextType) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const result = appointmentUpdateSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    // Fetch existing appointment to verify ownership and branch isolation
    const { data: existing, error: fetchError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single<{ id: string; branch_id: string; status: string }>();

    if (fetchError || !existing) {
      return apiError(404, "ERR_NOT_FOUND", "Appointment not found");
    }

    // Enforce branch isolation for Admin
    if (profile.role === "admin" && existing.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden to update appointment at another branch");
    }

    // Perform Update
    const { data: updated, error: updateError } = await supabase
      .from("appointments")
      .update({
        ...(result.data.appointment_date && { appointment_date: result.data.appointment_date }),
        ...(result.data.service_type && { service_type: result.data.service_type }),
        ...(result.data.notes !== undefined && { notes: result.data.notes }),
        ...(result.data.status && { status: result.data.status }),
      })
      .eq("id", id)
      .select("*, customer:customers(id, full_name, phone), car:cars(id, license_plate, make, model)")
      .single();

    if (updateError || !updated) {
      return apiError(500, "ERR_INTERNAL", updateError?.message ?? "Failed to update appointment");
    }

    // Safe relation extract
    const formatted = {
      ...updated,
      customer: Array.isArray(updated.customer) ? updated.customer[0] : updated.customer,
      car: Array.isArray(updated.car) ? updated.car[0] : updated.car,
    };

    // Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "UPDATE",
      table_name: "appointments",
      record_id: formatted.id,
      old_values: existing,
      new_values: formatted,
    });

    return apiSuccess(formatted);
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}

export async function DELETE(request: Request, context: ContextType) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;
  const { id } = await context.params;

  // Fetch existing
  const { data: existing, error: fetchError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single<{ id: string; branch_id: string }>();

  if (fetchError || !existing) {
    return apiError(404, "ERR_NOT_FOUND", "Appointment not found");
  }

  // Branch Isolation
  if (profile.role === "admin" && existing.branch_id !== profile.branch_id) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden to delete appointment at another branch");
  }

  // Soft Delete
  const { error: deleteError } = await supabase
    .from("appointments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (deleteError) {
    return apiError(500, "ERR_INTERNAL", deleteError.message);
  }

  // Audit Logging
  await supabase.from("audit_logs").insert({
    profile_id: user.id,
    action: "DELETE",
    table_name: "appointments",
    record_id: id,
    old_values: existing,
  });

  return apiSuccess({ message: "Appointment deleted successfully" });
}
