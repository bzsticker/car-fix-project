import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;
  const { id: sourceMovementId } = await params;

  try {
    // 1. Fetch the source 'transfer_out' stock movement
    const { data: sourceMovement, error: fetchMovError } = await supabase
      .from("stock_movements")
      .select("id, inventory_id, quantity, type, notes")
      .eq("id", sourceMovementId)
      .eq("type", "transfer_out")
      .single();

    if (fetchMovError || !sourceMovement) {
      return apiError(404, "ERR_NOT_FOUND", "Source transfer record not found");
    }

    // 2. Parse destination inventory ID from notes
    const notesStr = sourceMovement.notes || "";
    if (!notesStr.startsWith("transfer_to:")) {
      return apiError(422, "ERR_VALIDATION", "Malformed transfer notes record");
    }
    const destInventoryId = notesStr.split("transfer_to:")[1];

    if (!destInventoryId) {
      return apiError(422, "ERR_VALIDATION", "Destination inventory ID missing from transfer notes");
    }

    // 3. Fetch destination inventory record to verify branch isolation
    const { data: destInv, error: fetchDestError } = await supabase
      .from("inventories")
      .select("id, branch_id, quantity, product_id")
      .eq("id", destInventoryId)
      .is("deleted_at", null)
      .single();

    if (fetchDestError || !destInv) {
      return apiError(404, "ERR_NOT_FOUND", "Destination inventory record not found");
    }

    // 4. Enforce Branch Isolation (Only Admins from target branch can receive)
    if (profile.role === "admin" && destInv.branch_id !== profile.branch_id) {
      return apiError(
        403,
        "ERR_FORBIDDEN",
        "Forbidden. You can only confirm incoming transfers destined for your branch"
      );
    }

    // 5. Check if transfer has already been completed / received
    const { data: alreadyReceived, error: checkError } = await supabase
      .from("stock_movements")
      .select("id")
      .eq("type", "transfer_in")
      .eq("reference_id", sourceMovementId)
      .maybeSingle();

    if (checkError) {
      return apiError(500, "ERR_INTERNAL", checkError.message);
    }

    if (alreadyReceived) {
      return apiError(422, "ERR_VALIDATION", "This branch transfer has already been received");
    }

    const transferQty = Math.abs(sourceMovement.quantity);

    // 6. Atomic Transactional Transfer Completion
    // Increment stock at destination branch
    const newDestQuantity = destInv.quantity + transferQty;
    const { error: updateDestError } = await supabase
      .from("inventories")
      .update({ quantity: newDestQuantity })
      .eq("id", destInventoryId);

    if (updateDestError) {
      return apiError(500, "ERR_INTERNAL", updateDestError.message);
    }

    // Create 'transfer_in' stock movement entry
    const { data: movement, error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        inventory_id: destInventoryId,
        quantity: transferQty,
        type: "transfer_in",
        reference_id: sourceMovementId,
        created_by: user.id,
        notes: `transfer_received_from_movement:${sourceMovementId}`,
      })
      .select()
      .single();

    if (movementError || !movement) {
      // Rollback destination quantity increment
      await supabase
        .from("inventories")
        .update({ quantity: destInv.quantity })
        .eq("id", destInventoryId);

      return apiError(500, "ERR_INTERNAL", movementError?.message ?? "Failed to create stock movement record");
    }

    // Fetch complete details for audit log
    const { data: completeDest } = await supabase
      .from("inventories")
      .select("*, product:products(*)")
      .eq("id", destInventoryId)
      .single();

    // 7. Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "UPDATE",
      table_name: "inventories",
      record_id: destInventoryId,
      old_values: {
        quantity: destInv.quantity,
      },
      new_values: {
        inventory: completeDest,
        stock_movement: movement,
      },
    });

    return apiSuccess({
      destination_inventory: completeDest,
      stock_movement: movement,
    });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
