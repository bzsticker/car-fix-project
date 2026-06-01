import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

const quoteUpdateSchema = z.object({
  status: z.enum(["draft", "sent", "approved", "rejected", "expired"]).optional(),
  valid_until: z.string().datetime().optional(),
  job_id: z.uuid().nullable().optional(),
});

type ContextType = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: ContextType) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase } = auth;
  const { id } = await context.params;

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*, customer:customers(id, full_name, phone), car:cars(id, license_plate, make, model), items:quote_items(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !quote) {
    return apiError(404, "ERR_NOT_FOUND", "Quotation not found");
  }

  // Branch Isolation
  const quoteRow = quote as { branch_id: string };
  if (profile.role !== "owner" && profile.branch_id && quoteRow.branch_id !== profile.branch_id) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden to view quotation at another branch");
  }

  // Safe relation extract
  const formatted = {
    ...quote,
    customer: Array.isArray(quote.customer) ? quote.customer[0] : quote.customer,
    car: Array.isArray(quote.car) ? quote.car[0] : quote.car,
  };

  return apiSuccess(formatted);
}

export async function PUT(request: Request, context: ContextType) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const result = quoteUpdateSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    // Fetch existing
    const { data: existing, error: fetchError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single<{ id: string; branch_id: string; status: string }>();

    if (fetchError || !existing) {
      return apiError(404, "ERR_NOT_FOUND", "Quotation not found");
    }

    // Enforce Branch Isolation
    if (profile.role === "admin" && existing.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden to update quotation at another branch");
    }

    // Perform Update
    const { data: updated, error: updateError } = await supabase
      .from("quotes")
      .update({
        ...(result.data.status && { status: result.data.status }),
        ...(result.data.valid_until && { valid_until: result.data.valid_until }),
        ...(result.data.job_id !== undefined && { job_id: result.data.job_id }),
      })
      .eq("id", id)
      .select("*, customer:customers(id, full_name, phone), car:cars(id, license_plate, make, model), items:quote_items(*)")
      .single();

    if (updateError || !updated) {
      return apiError(500, "ERR_INTERNAL", updateError?.message ?? "Failed to update Quotation");
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
      table_name: "quotes",
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
    .from("quotes")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single<{ id: string; branch_id: string }>();

  if (fetchError || !existing) {
    return apiError(404, "ERR_NOT_FOUND", "Quotation not found");
  }

  // Branch Isolation
  if (profile.role === "admin" && existing.branch_id !== profile.branch_id) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden to delete quotation at another branch");
  }

  // Soft Delete
  const { error: deleteError } = await supabase
    .from("quotes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (deleteError) {
    return apiError(500, "ERR_INTERNAL", deleteError.message);
  }

  // Audit Logging
  await supabase.from("audit_logs").insert({
    profile_id: user.id,
    action: "DELETE",
    table_name: "quotes",
    record_id: id,
    old_values: existing,
  });

  return apiSuccess({ message: "Quotation deleted successfully" });
}
