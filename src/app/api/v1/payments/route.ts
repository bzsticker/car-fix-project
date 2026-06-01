import { z } from "zod";

import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

const paymentSchema = z.object({
  invoice_id: z.uuid(),
  amount: z.number().positive("Payment amount must be greater than zero"),
  payment_method: z.enum(["cash", "credit_card", "bank_transfer", "qr_payment"]),
  transaction_reference: z.string().max(100).nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase, user } = auth;

  try {
    const body = await request.json();
    const result = paymentSchema.safeParse(body);

    if (!result.success) {
      return apiError(422, "ERR_VALIDATION", "Input validation failed", result.error.flatten().fieldErrors);
    }

    // 1. Fetch target invoice to verify existence and amount due
    const { data: invoice, error: invoiceFetchError } = await supabase
      .from("invoices")
      .select("id, branch_id, amount_due, status")
      .eq("id", result.data.invoice_id)
      .is("deleted_at", null)
      .single<{ id: string; branch_id: string; amount_due: number; status: string }>();

    if (invoiceFetchError || !invoice) {
      return apiError(404, "ERR_NOT_FOUND", "Invoice profile not found");
    }

    // 2. Enforce Branch Isolation
    if (profile.role === "admin" && invoice.branch_id !== profile.branch_id) {
      return apiError(403, "ERR_FORBIDDEN", "Forbidden to record payment for invoice from another branch");
    }

    // 3. Prevent duplicate payment if already paid
    if (invoice.status === "paid" || invoice.amount_due <= 0) {
      return apiError(422, "ERR_VALIDATION", "This invoice has already been fully paid");
    }

    // 3b. Prevent payment overcollection exceeding amount due
    if (result.data.amount > invoice.amount_due) {
      return apiError(
        422,
        "ERR_VALIDATION",
        `Payment amount of ${result.data.amount} THB exceeds the remaining invoice amount due of ${invoice.amount_due} THB`
      );
    }

    // 4. Insert Payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        invoice_id: result.data.invoice_id,
        amount: result.data.amount,
        payment_method: result.data.payment_method,
        transaction_reference: result.data.transaction_reference || null,
      })
      .select()
      .single();

    if (paymentError || !payment) {
      return apiError(500, "ERR_INTERNAL", paymentError?.message ?? "Failed to register payment");
    }

    // 5. Update Invoice status & amount due
    const newAmountDue = Math.max(0, invoice.amount_due - result.data.amount);
    const newStatus = newAmountDue <= 0 ? "paid" : "partially_paid";

    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update({
        amount_due: newAmountDue,
        status: newStatus,
      })
      .eq("id", invoice.id);

    if (invoiceUpdateError) {
      // Rollback payment on invoice update failure to preserve consistency
      await supabase.from("payments").delete().eq("id", payment.id);
      return apiError(500, "ERR_INTERNAL", invoiceUpdateError.message);
    }

    // Fetch complete invoice data for audit log
    const { data: completeInvoice } = await supabase
      .from("invoices")
      .select("*, customer:customers(id, full_name, phone), payments:payments(*)")
      .eq("id", invoice.id)
      .single();

    // 6. Audit Logging
    await supabase.from("audit_logs").insert({
      profile_id: user.id,
      action: "INSERT",
      table_name: "payments",
      record_id: payment.id,
      new_values: {
        payment,
        updated_invoice: completeInvoice,
      },
    });

    return apiSuccess({
      payment,
      invoice: completeInvoice,
    }, { status: 201 });
  } catch {
    return apiError(400, "ERR_BAD_REQUEST", "Malformed JSON payload");
  }
}
