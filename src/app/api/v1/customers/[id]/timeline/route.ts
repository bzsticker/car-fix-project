import { requireApiAuth } from "@/lib/api/auth";
import { firstRelation } from "@/lib/api/relations";
import { getCustomerScope } from "@/lib/api/resources";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

type TimelineEvent = {
  timestamp: string;
  event_type: string;
  description: string;
  reference_id: string;
};

type JobTimelineRow = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  car: { make: string; model: string; license_plate: string } | { make: string; model: string; license_plate: string }[] | null;
};

type AppointmentTimelineRow = {
  id: string;
  appointment_date: string;
  service_type: string;
  status: string;
};

type QuoteTimelineRow = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
};

type InvoiceTimelineRow = {
  id: string;
  invoice_number: string;
  total_amount: number;
  created_at: string;
};

type PaymentTimelineRow = {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
};

type PosTimelineRow = {
  id: string;
  sales_number: string;
  total_amount: number;
  created_at: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(["owner", "admin", "technician"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await params;
  const { profile, supabase } = auth;
  const customer = await getCustomerScope(supabase, id);

  if (!customer) {
    return apiError(404, "ERR_NOT_FOUND", "Customer not found");
  }

  if (!canReadBranch(profile, customer.branch_id)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  const [
    { data: jobs, error: jobsError },
    { data: appointments, error: appointmentsError },
    { data: quotes, error: quotesError },
    { data: invoices, error: invoicesError },
    { data: posSales, error: posSalesError },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, status, total_amount, created_at, car:cars(make, model, license_plate)")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id, appointment_date, service_type, status")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("appointment_date", { ascending: false }),
    supabase
      .from("quotes")
      .select("id, status, total_amount, created_at")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, created_at")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("pos_sales")
      .select("id, sales_number, total_amount, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (jobsError || appointmentsError || quotesError || invoicesError || posSalesError) {
    return apiError(
      500,
      "ERR_INTERNAL",
      jobsError?.message ??
        appointmentsError?.message ??
        quotesError?.message ??
        invoicesError?.message ??
        posSalesError?.message ??
        "Failed to load customer timeline",
    );
  }

  const invoiceIds = (invoices ?? []).map((invoice) => invoice.id);
  const { data: payments, error: paymentsError } = invoiceIds.length
    ? await supabase
        .from("payments")
        .select("id, invoice_id, amount, payment_date")
        .in("invoice_id", invoiceIds)
        .order("payment_date", { ascending: false })
    : { data: [] as PaymentTimelineRow[], error: null };

  if (paymentsError) {
    return apiError(500, "ERR_INTERNAL", paymentsError.message);
  }

  const invoiceMap = new Map((invoices ?? []).map((invoice) => [invoice.id, invoice]));
  const timeline: TimelineEvent[] = [];

  for (const payment of (payments ?? []) as PaymentTimelineRow[]) {
    const invoice = invoiceMap.get(payment.invoice_id);
    timeline.push({
      timestamp: payment.payment_date,
      event_type: "payment_received",
      description: `Payment of ${Number(payment.amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} THB received for Invoice #${invoice?.invoice_number ?? payment.invoice_id}`,
      reference_id: payment.id,
    });
  }

  for (const invoice of (invoices ?? []) as InvoiceTimelineRow[]) {
    timeline.push({
      timestamp: invoice.created_at,
      event_type: "invoice_created",
      description: `Invoice #${invoice.invoice_number} issued for ${Number(invoice.total_amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} THB`,
      reference_id: invoice.id,
    });
  }

  for (const job of (jobs ?? []) as JobTimelineRow[]) {
    const car = firstRelation(job.car);
    timeline.push({
      timestamp: job.created_at,
      event_type: "job_created",
      description: `Job #${job.id} initialized for ${car?.make ?? "Unknown"} ${car?.model ?? ""} (${car?.license_plate ?? "Unknown Plate"})`,
      reference_id: job.id,
    });
  }

  for (const appointment of (appointments ?? []) as AppointmentTimelineRow[]) {
    timeline.push({
      timestamp: appointment.appointment_date,
      event_type: "appointment_booked",
      description: `Appointment booked for ${appointment.service_type.replaceAll("_", " ")} (${appointment.status})`,
      reference_id: appointment.id,
    });
  }

  for (const quote of (quotes ?? []) as QuoteTimelineRow[]) {
    timeline.push({
      timestamp: quote.created_at,
      event_type: "quote_created",
      description: `Quote #${quote.id} created with ${Number(quote.total_amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} THB total (${quote.status})`,
      reference_id: quote.id,
    });
  }

  for (const sale of (posSales ?? []) as PosTimelineRow[]) {
    timeline.push({
      timestamp: sale.created_at,
      event_type: "pos_sale_completed",
      description: `POS sale #${sale.sales_number} completed for ${Number(sale.total_amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} THB`,
      reference_id: sale.id,
    });
  }

  timeline.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));

  return apiSuccess({
    customer_id: id,
    timeline,
  });
}
