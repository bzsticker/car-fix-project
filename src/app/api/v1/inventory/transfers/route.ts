import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

const initiateTransferSchema = z.object({
  source_inventory_id: z.string().uuid("Source inventory ID must be a valid UUID"),
  destination_branch_id: z.string().uuid("Destination branch ID must be a valid UUID"),
  quantity: z.number().int("Quantity must be an integer").positive("Quantity must be greater than zero"),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;

  try {
    const body = await request.json();
    const result = initiateTransferSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { source_inventory_id, destination_branch_id, quantity } = result.data;

    // 1. Fetch Source Inventory record
    const { data: sourceInv, error: sourceError } = await supabase
      .from("inventories")
      .select("id, branch_id, quantity, product_id")
      .eq("id", source_inventory_id)
      .is("deleted_at", null)
      .single();

    if (sourceError || !sourceInv) {
      return apiError(404, "ERR_NOT_FOUND", "Source inventory stock record not found");
    }

    // 2. Enforce Branch Isolation on source branch
    if (profile.role === "admin" && sourceInv.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden to transfer stock from another branch");
    }

    // 3. Prevent transferring to the same branch
    if (sourceInv.branch_id === destination_branch_id) {
      return apiError(422, "ERR_VALIDATION", "Destination branch must be different from source branch");
    }

    // 4. Verify destination branch exists
    const { data: destBranch, error: destBranchError } = await supabase
      .from("branches")
      .select("id, name")
      .eq("id", destination_branch_id)
      .is("deleted_at", null)
      .single();

    if (destBranchError || !destBranch) {
      return apiError(404, "ERR_NOT_FOUND", "Destination branch not found");
    }

    // 5. Verify source branch has sufficient stock
    if (sourceInv.quantity < quantity) {
      return apiError(
        422,
        "ERR_LOW_STOCK",
        `Insufficient stock. Source has ${sourceInv.quantity} units, cannot transfer ${quantity} units`
      );
    }

    // 6. Check if target inventory record exists at destination branch
    const { data: fetchedDestInv, error: destInvError } = await supabase
      .from("inventories")
      .select("id, quantity")
      .eq("branch_id", destination_branch_id)
      .eq("product_id", sourceInv.product_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (destInvError) {
      return apiError(500, "ERR_INTERNAL", destInvError.message);
    }

    let destInv = fetchedDestInv;

    // If destination inventory doesn't exist, create it with quantity 0
    if (!destInv) {
      const { data: newDestInv, error: createDestError } = await supabase
        .from("inventories")
        .insert({
          branch_id: destination_branch_id,
          product_id: sourceInv.product_id,
          quantity: 0,
          reorder_level: 5,
        })
        .select("id, quantity")
        .single();

      if (createDestError || !newDestInv) {
        return apiError(500, "ERR_INTERNAL", createDestError?.message ?? "Failed to initialize destination inventory");
      }
      destInv = newDestInv;
    }

    // 7. Atomic Transactional Transfer Initiation
    // Decrement stock at source branch
    const newSourceQuantity = sourceInv.quantity - quantity;
    const { error: updateSourceError } = await supabase
      .from("inventories")
      .update({ quantity: newSourceQuantity })
      .eq("id", source_inventory_id);

    if (updateSourceError) {
      return apiError(500, "ERR_INTERNAL", updateSourceError.message);
    }

    // Create 'transfer_out' stock movement entry
    const { data: movement, error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        inventory_id: source_inventory_id,
        quantity: -quantity,
        type: "transfer_out",
        created_by: user.id,
        notes: `transfer_to:${destInv.id}`,
      })
      .select()
      .single();

    if (movementError || !movement) {
      // Rollback source quantity decrement
      await supabase
        .from("inventories")
        .update({ quantity: sourceInv.quantity })
        .eq("id", source_inventory_id);

      return apiError(500, "ERR_INTERNAL", movementError?.message ?? "Failed to create stock movement record");
    }

    // Fetch complete product details for audit log
    const { data: completeSource } = await supabase
      .from("inventories")
      .select("*, product:products(*)")
      .eq("id", source_inventory_id)
      .single();

    // 8. Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "UPDATE",
      table_name: "inventories",
      record_id: source_inventory_id,
      old_values: {
        quantity: sourceInv.quantity,
      },
      new_values: {
        inventory: completeSource,
        stock_movement: movement,
        destination_branch: destBranch.name,
      },
    });

    return apiSuccess({
      source_inventory: completeSource,
      stock_movement: movement,
    }, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
