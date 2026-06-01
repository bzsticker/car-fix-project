import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";

const checkoutItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
});

const posCheckoutSchema = z.object({
  branch_id: z.string().uuid(),
  customer_id: z.string().uuid().optional().nullable(),
  payment_method: z.enum(["cash", "credit_card", "bank_transfer", "qr_payment"]),
  transaction_reference: z.string().optional().nullable(),
  discount_amount: z.number().nonnegative().optional().default(0),
  items: z.array(checkoutItemSchema).min(1),
});

export async function POST(request: NextRequest) {
  // 1. Authenticate and authorize (Only Owner and Admin allowed)
  const authContext = await requireApiAuth(["owner", "admin"]);
  if ("response" in authContext) {
    return authContext.response;
  }

  const { supabase, profile } = authContext;

  try {
    const body = await request.json();
    const parsed = posCheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        400,
        "ERR_BAD_REQUEST",
        "Invalid checkout payload",
        parsed.error.flatten()
      );
    }

    const {
      branch_id,
      payment_method,
      transaction_reference,
      discount_amount,
      items,
    } = parsed.data;

    let customer_id = parsed.data.customer_id;

    // 2. Fallback guest customer creation/lookup (since invoices.customer_id is NOT NULL)
    if (!customer_id) {
      const { data: guestCustomer, error: findError } = await supabase
        .from("customers")
        .select("id")
        .eq("full_name", "Guest Walk-in")
        .eq("branch_id", branch_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (findError) {
        throw new Error(`Failed to lookup guest customer: ${findError.message}`);
      }

      if (guestCustomer) {
        customer_id = guestCustomer.id;
      } else {
        // Create new guest customer profile for this branch
        const { data: newGuest, error: createError } = await supabase
          .from("customers")
          .insert({
            branch_id,
            full_name: "Guest Walk-in",
            phone: "--",
            email: null,
            line_user_id: null,
          })
          .select("id")
          .single();

        if (createError || !newGuest) {
          throw new Error(`Failed to create guest customer record: ${createError?.message}`);
        }

        customer_id = newGuest.id;
      }
    }

    // 3. Verify stock availability & fetch product details
    const productIds = items.map((i) => i.product_id);
    const [
      { data: stockLevels, error: stockError },
      { data: products, error: productError },
    ] = await Promise.all([
      supabase
        .from("inventories")
        .select("id, product_id, quantity")
        .eq("branch_id", branch_id)
        .in("product_id", productIds),
      supabase
        .from("products")
        .select("id, sku, name, retail_price")
        .in("id", productIds),
    ]);

    if (stockError || !stockLevels) {
      return apiError(
        500,
        "ERR_INTERNAL",
        `Failed to retrieve stock levels: ${stockError?.message}`
      );
    }

    if (productError || !products) {
      return apiError(
        500,
        "ERR_INTERNAL",
        `Failed to retrieve product details: ${productError?.message}`
      );
    }

    // Map inventories by product_id
    const inventoryMap = new Map(stockLevels.map((s) => [s.product_id, s]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      const inv = inventoryMap.get(item.product_id);
      const prod = productMap.get(item.product_id);

      if (!inv || inv.quantity < item.quantity) {
        return apiError(
          422,
          "ERR_LOW_STOCK",
          `Insufficient stock for product: ${prod?.name ?? item.product_id}. Available: ${inv?.quantity ?? 0}, Requested: ${item.quantity}`
        );
      }
    }

    // 4. Calculate total amounts
    let subtotal = 0;
    const itemDetails = items.map((item) => {
      const prod = productMap.get(item.product_id);
      const total_price = item.quantity * item.unit_price;
      subtotal += total_price;

      return {
        product_id: item.product_id,
        description: prod?.name ?? "Retail Parts SKU",
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price,
      };
    });

    const taxableAmount = Math.max(0, subtotal - discount_amount);
    const tax_amount = parseFloat((taxableAmount * 0.07).toFixed(2));
    const total_amount = parseFloat((taxableAmount + tax_amount).toFixed(2));

    // 5. Generate identifiers
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 8);
    const randomHex = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    const sales_number = `POS-${timestamp}-${randomHex}`;
    const invoice_number = `INV-POS-${timestamp}-${randomHex}`;

    // 6. DB operations within sequential execution (Simulated safe transaction rollback)
    // First, insert invoice
    const { data: invoice, error: invoiceErr } = await supabase
      .from("invoices")
      .insert({
        branch_id,
        customer_id,
        invoice_number,
        amount_due: 0, // Paid immediately
        tax_amount,
        discount_amount,
        total_amount,
        status: "paid",
        due_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (invoiceErr || !invoice) {
      throw new Error(`Failed to record POS transaction invoice: ${invoiceErr?.message}`);
    }

    // Insert payment
    const { error: paymentErr } = await supabase
      .from("payments")
      .insert({
        invoice_id: invoice.id,
        amount: total_amount,
        payment_method,
        transaction_reference: transaction_reference || null,
        payment_date: new Date().toISOString(),
      });

    if (paymentErr) {
      // Manual cleanup (simulating atomic constraint fallback)
      await supabase.from("invoices").delete().eq("id", invoice.id);
      throw new Error(`Failed to register payment ledger: ${paymentErr.message}`);
    }

    // Insert POS sale
    const { data: posSale, error: posSaleErr } = await supabase
      .from("pos_sales")
      .insert({
        branch_id,
        customer_id,
        invoice_id: invoice.id,
        sales_number,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        status: "completed",
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (posSaleErr || !posSale) {
      await supabase.from("invoices").delete().eq("id", invoice.id);
      throw new Error(`Failed to create POS checkout header: ${posSaleErr?.message}`);
    }

    // Insert POS items and update inventory in sequence
    for (const item of itemDetails) {
      // Insert item record
      const { error: itemErr } = await supabase
        .from("pos_sale_items")
        .insert({
          pos_sale_id: posSale.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        });

      if (itemErr) {
        // Rollback all created entities
        await Promise.all([
          supabase.from("pos_sales").delete().eq("id", posSale.id),
          supabase.from("invoices").delete().eq("id", invoice.id),
        ]);
        throw new Error(`Failed to register transaction line item: ${itemErr.message}`);
      }

      // Deduct inventory
      const inv = inventoryMap.get(item.product_id)!;
      const newQty = inv.quantity - item.quantity;

      const { error: invErr } = await supabase
        .from("inventories")
        .update({ quantity: newQty })
        .eq("id", inv.id);

      if (invErr) {
        await Promise.all([
          supabase.from("pos_sales").delete().eq("id", posSale.id),
          supabase.from("invoices").delete().eq("id", invoice.id),
        ]);
        throw new Error(`Failed to update branch inventory quantities: ${invErr.message}`);
      }

      // Record stock movement (type: manual_adjustment, notes: pos_sale:<id>)
      const { error: moveErr } = await supabase
        .from("stock_movements")
        .insert({
          inventory_id: inv.id,
          quantity: -item.quantity,
          type: "manual_adjustment",
          reference_id: posSale.id,
          created_by: profile.id,
          notes: `pos_sale:${posSale.id}`,
        });

      if (moveErr) {
        // Critical: In real postgres, atomic triggers handle this or transaction rolls back
        console.error(`Stock movement log write failed for POS checkout: ${moveErr.message}`);
      }
    }

    // Write audit log
    await writeAuditLog({
      supabase,
      request,
      profileId: profile.id,
      action: "pos_checkout",
      tableName: "pos_sales",
      recordId: posSale.id,
      newValues: {
        sales_number,
        total_amount,
        items_count: items.length,
      },
    });

    return apiSuccess({
      success: true,
      data: {
        pos_sale_id: posSale.id,
        sales_number,
        invoice_number,
        total_amount,
        payment_method,
        status: "completed",
      },
    });
  } catch (err) {
    return apiError(
      500,
      "ERR_INTERNAL",
      err instanceof Error ? err.message : "Failed to execute POS cashier checkout transaction"
    );
  }
}
