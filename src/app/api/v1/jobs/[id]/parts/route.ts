import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

const addJobPartSchema = z.object({
  inventory_id: z.string().uuid("Inventory ID must be a valid UUID"),
  quantity: z.number().int("Quantity must be an integer").positive("Quantity must be greater than zero"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;
  const { id: jobId } = await params;

  try {
    const body = await request.json();
    const result = addJobPartSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    const { inventory_id, quantity } = result.data;

    // 1. Fetch Job ticket
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

    // 3. Fetch Inventory stock record
    const { data: inventory, error: invError } = await supabase
      .from("inventories")
      .select("id, branch_id, quantity, product_id")
      .eq("id", inventory_id)
      .is("deleted_at", null)
      .single();

    if (invError || !inventory) {
      return apiError(404, "ERR_NOT_FOUND", "Inventory stock record not found");
    }

    // 4. Verify inventory belongs to the same branch as the job
    if (inventory.branch_id !== job.branch_id) {
      return apiError(422, "ERR_VALIDATION", "Inventory item must belong to the job's branch");
    }

    // 5. Verify stock quantity availability
    if (inventory.quantity < quantity) {
      return apiError(
        422,
        "ERR_LOW_STOCK",
        `Insufficient inventory. Branch stock has ${inventory.quantity} units, cannot allocate ${quantity} units`
      );
    }

    // 6. Fetch catalog product pricing
    const { data: product, error: prodError } = await supabase
      .from("products")
      .select("id, name, retail_price")
      .eq("id", inventory.product_id)
      .is("deleted_at", null)
      .single();

    if (prodError || !product) {
      return apiError(404, "ERR_NOT_FOUND", "Catalog product not found");
    }

    const unitPrice = product.retail_price;
    const totalPrice = unitPrice * quantity;

    // 7. Atomic Transactional Parts Consumption (delegated to DB Trigger)
    // Insert into public.job_parts, which triggers tr_job_parts_inserted to decrement inventory and log stock_movement
    const { data: jobPart, error: jobPartError } = await supabase
      .from("job_parts")
      .insert({
        job_id: jobId,
        inventory_id,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      })
      .select()
      .single();

    if (jobPartError || !jobPart) {
      return apiError(500, "ERR_INTERNAL", jobPartError?.message ?? "Failed to add part to job sheet");
    }

    // Fetch the auto-created stock movement entry from the DB trigger to return in the API payload
    const { data: movement } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("inventory_id", inventory_id)
      .eq("reference_id", jobId)
      .eq("quantity", -quantity)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 8. Re-calculate overall Job total_amount
    const { data: services } = await supabase.from("job_services").select("price").eq("job_id", jobId);
    const { data: parts } = await supabase.from("job_parts").select("total_price").eq("job_id", jobId);

    const servicesSum = services?.reduce((acc, s) => acc + Number(s.price), 0) ?? 0;
    const partsSum = parts?.reduce((acc, p) => acc + Number(p.total_price), 0) ?? 0;
    const newJobTotal = servicesSum + partsSum;

    const { error: updateJobError } = await supabase
      .from("jobs")
      .update({ total_amount: newJobTotal })
      .eq("id", jobId);

    if (updateJobError) {
      // Rollback job parts insert
      await supabase.from("job_parts").delete().eq("id", jobPart.id);
      
      // Manually restore inventory stock since there is no DB trigger for delete/update
      await supabase.from("inventories").update({ quantity: inventory.quantity }).eq("id", inventory_id);
      if (movement) {
        await supabase.from("stock_movements").delete().eq("id", movement.id);
      }

      return apiError(500, "ERR_INTERNAL", updateJobError.message);
    }

    // 9. Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "INSERT",
      table_name: "job_parts",
      record_id: jobPart.id,
      new_values: {
        job_part: jobPart,
        stock_movement: movement || null,
        updated_job_total: newJobTotal,
      },
    });

    return apiSuccess({
      job_part: jobPart,
      stock_movement: movement || null,
      job_total_amount: newJobTotal,
    }, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
