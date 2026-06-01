import { requireApiAuth } from "@/lib/api/auth";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const requestedBranchId = searchParams.get("filter_branch_id");
  const startDateStr = searchParams.get("start_date");
  const endDateStr = searchParams.get("end_date");

  // 1. Branch Isolation Validation
  let branchId = profile.branch_id;
  if (profile.role === "owner") {
    branchId = requestedBranchId || null;
  } else if (requestedBranchId && !canReadBranch(profile, requestedBranchId)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  try {
    // Build queries for Invoices & Payments
    let invQuery = supabase
      .from("invoices")
      .select("total_amount, tax_amount, discount_amount, amount_due, created_at, status")
      .is("deleted_at", null);

    let pmtQuery = supabase
      .from("payments")
      .select("amount, payment_date, payment_method, invoice:invoices!inner(branch_id)")
      .is("invoice.deleted_at", null);

    // Apply branch filters
    if (branchId) {
      invQuery = invQuery.eq("branch_id", branchId);
      pmtQuery = pmtQuery.eq("invoice.branch_id", branchId);
    }

    // Apply date range filters if provided
    if (startDateStr) {
      invQuery = invQuery.gte("created_at", startDateStr);
      pmtQuery = pmtQuery.gte("payment_date", startDateStr);
    }
    if (endDateStr) {
      invQuery = invQuery.lte("created_at", endDateStr);
      pmtQuery = pmtQuery.lte("payment_date", endDateStr);
    }

    const [invRes, pmtRes] = await Promise.all([invQuery, pmtQuery]);

    if (invRes.error) return apiError(500, "ERR_INTERNAL", invRes.error.message);
    if (pmtRes.error) return apiError(500, "ERR_INTERNAL", pmtRes.error.message);

    const invoices = invRes.data ?? [];
    const payments = pmtRes.data ?? [];

    // Calculate aggregated metrics
    const totalInvoiced = invoices.reduce((acc, inv) => acc + Number(inv.total_amount), 0);
    const totalTax = invoices.reduce((acc, inv) => acc + Number(inv.tax_amount), 0);
    const totalDiscount = invoices.reduce((acc, inv) => acc + Number(inv.discount_amount), 0);
    const totalOutstanding = invoices.reduce((acc, inv) => acc + Number(inv.amount_due), 0);
    const totalReceived = payments.reduce((acc, pmt) => acc + Number(pmt.amount), 0);

    // Breakdown payments by method
    const byMethod = payments.reduce((acc: Record<string, number>, pmt) => {
      const method = pmt.payment_method;
      acc[method] = (acc[method] || 0) + Number(pmt.amount);
      return acc;
    }, {});

    return apiSuccess({
      branch_id: branchId ?? "all_branches",
      total_invoiced: totalInvoiced,
      total_received: totalReceived,
      total_tax: totalTax,
      total_discount: totalDiscount,
      total_outstanding: totalOutstanding,
      payments_by_method: byMethod,
      invoice_count: invoices.length,
      payment_count: payments.length,
    });
  } catch (err) {
    return apiError(500, "ERR_INTERNAL", err instanceof Error ? err.message : "Failed to generate report");
  }
}
