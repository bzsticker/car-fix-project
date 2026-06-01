import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

const adjustStockSchema = z.object({
  inventory_id: z.string().uuid("Inventory ID must be a valid UUID"),
  quantity_change: z.number().int("Quantity change must be an integer").refine((val) => val !== 0, {
    message: "Quantity change cannot be zero",
  }),
  adjustment_type: z.enum(["stock_in", "manual_adjustment", "write_off"]),
  notes: z.string().min(5, "Notes must be at least 5 characters"),
});

export async function PUT(request: Request) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;

  try {
    const body = await request.json();
    const result = adjustStockSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { inventory_id, quantity_change, adjustment_type, notes } = result.data;

    // 1. Fetch inventory record to verify existence & branch
    const { data: inventory, error: fetchError } = await supabase
      .from("inventories")
      .select("id, branch_id, quantity, product_id")
      .eq("id", inventory_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !inventory) {
      return apiError(404, "ERR_NOT_FOUND", "Inventory stock record not found");
    }

    // 2. Enforce Branch Isolation
    if (profile.role === "admin" && inventory.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden to adjust inventory from another branch");
    }

    // 3. Prevent negative stock levels
    const newQuantity = inventory.quantity + quantity_change;
    if (newQuantity < 0) {
      return apiError(
        422,
        "ERR_VALIDATION",
        `Insufficient stock. Available stock is ${inventory.quantity}, cannot deduct ${Math.abs(quantity_change)}`
      );
    }

    // 4. Update Inventory Level
    const { data: updatedInventory, error: updateError } = await supabase
      .from("inventories")
      .update({ quantity: newQuantity })
      .eq("id", inventory_id)
      .select()
      .single();

    if (updateError || !updatedInventory) {
      return apiError(500, "ERR_INTERNAL", updateError?.message ?? "Failed to update inventory quantity");
    }

    // 5. Create Stock Movement Log Entry (Immutable Ledger)
    const { data: movement, error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        inventory_id,
        quantity: quantity_change,
        type: adjustment_type,
        created_by: user.id,
        notes,
      })
      .select()
      .single();

    if (movementError || !movement) {
      // Rollback quantity update on movement log failure to preserve data consistency
      await supabase
        .from("inventories")
        .update({ quantity: inventory.quantity })
        .eq("id", inventory_id);

      return apiError(500, "ERR_INTERNAL", movementError?.message ?? "Failed to create stock movement record");
    }

    // Fetch nested details for audit log
    const { data: completeInventory } = await supabase
      .from("inventories")
      .select("*, product:products(*)")
      .eq("id", inventory_id)
      .single();

    // 6. Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "UPDATE",
      table_name: "inventories",
      record_id: inventory_id,
      old_values: {
        quantity: inventory.quantity,
      },
      new_values: {
        inventory: completeInventory,
        stock_movement: movement,
      },
    });

    return apiSuccess({
      inventory: completeInventory,
      stock_movement: movement,
    });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
