import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; part_id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;
  const { id: jobId, part_id: partId } = await params;

  try {
    // 1. Fetch the Job ticket to verify existence & branch
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, branch_id, status, total_amount")
      .eq("id", jobId)
      .is("deleted_at", null)
      .single();

    if (jobError || !job) {
      return apiError(404, "ERR_NOT_FOUND", "Job ticket profile not found");
    }

    // 2. Enforce Branch Isolation on the Job
    if (profile.role === "admin" && job.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden to modify job details of another branch");
    }

    // 3. Fetch the Job Part consumption record
    const { data: jobPart, error: partError } = await supabase
      .from("job_parts")
      .select("id, job_id, inventory_id, quantity, total_price")
      .eq("id", partId)
      .single();

    if (partError || !jobPart) {
      return apiError(404, "ERR_NOT_FOUND", "Job part record not found in job sheet");
    }

    // Verify the part is linked to the correct job
    if (jobPart.job_id !== jobId) {
      return apiError(422, "ERR_VALIDATION", "Job part record mismatch with Job ID");
    }

    // 4. Fetch the target Inventory stock record to refund
    const { data: inventory, error: invError } = await supabase
      .from("inventories")
      .select("id, quantity")
      .eq("id", jobPart.inventory_id)
      .is("deleted_at", null)
      .single();

    if (invError || !inventory) {
      return apiError(404, "ERR_NOT_FOUND", "Inventory stock record not found");
    }

    // 5. Atomic Transactional Part Deletion & Refund
    // Increment stock at branch inventory
    const refundedQty = inventory.quantity + jobPart.quantity;
    const { error: refundError } = await supabase
      .from("inventories")
      .update({ quantity: refundedQty })
      .eq("id", jobPart.inventory_id);

    if (refundError) {
      return apiError(500, "ERR_INTERNAL", refundError.message);
    }

    // Create 'stock_in' movement log (to log the refund)
    const { data: movement, error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        inventory_id: jobPart.inventory_id,
        quantity: jobPart.quantity,
        type: "stock_in",
        reference_id: jobId,
        created_by: user.id,
        notes: `Refunded from deleted Job Part of Job Ticket: ${jobId}`,
      })
      .select()
      .single();

    if (movementError || !movement) {
      // Rollback stock refund
      await supabase
        .from("inventories")
        .update({ quantity: inventory.quantity })
        .eq("id", jobPart.inventory_id);

      return apiError(500, "ERR_INTERNAL", movementError?.message ?? "Failed to create refund stock movement record");
    }

    // Delete job part record from public.job_parts
    const { error: deleteError } = await supabase
      .from("job_parts")
      .delete()
      .eq("id", partId);

    if (deleteError) {
      // Rollback stock refund and movement log
      await supabase.from("inventories").update({ quantity: inventory.quantity }).eq("id", jobPart.inventory_id);
      await supabase.from("stock_movements").delete().eq("id", movement.id);

      return apiError(500, "ERR_INTERNAL", deleteError.message);
    }

    // 6. Re-calculate overall Job total_amount (after deletion)
    const { data: services } = await supabase.from("job_services").select("price").eq("job_id", jobId);
    const { data: remainingParts } = await supabase.from("job_parts").select("total_price").eq("job_id", jobId);

    const servicesSum = services?.reduce((acc, s) => acc + Number(s.price), 0) ?? 0;
    const partsSum = remainingParts?.reduce((acc, p) => acc + Number(p.total_price), 0) ?? 0;
    const newJobTotal = servicesSum + partsSum;

    const { error: updateJobError } = await supabase
      .from("jobs")
      .update({ total_amount: newJobTotal })
      .eq("id", jobId);

    if (updateJobError) {
      // Restore deleted job part and rollback stock/movement
      await supabase.from("job_parts").insert({
        id: jobPart.id,
        job_id: jobId,
        inventory_id: jobPart.inventory_id,
        quantity: jobPart.quantity,
        unit_price: Number(jobPart.total_price) / jobPart.quantity,
        total_price: jobPart.total_price,
      });
      await supabase.from("stock_movements").delete().eq("id", movement.id);
      await supabase.from("inventories").update({ quantity: inventory.quantity }).eq("id", jobPart.inventory_id);

      return apiError(500, "ERR_INTERNAL", updateJobError.message);
    }

    // 7. Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "DELETE",
      table_name: "job_parts",
      record_id: partId,
      old_values: {
        job_part: jobPart,
        updated_job_total: newJobTotal,
      },
    });

    return apiSuccess({
      success: true,
      message: "Job part successfully removed and stock refunded",
      job_total_amount: newJobTotal,
    });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON request");
  }
}
