import { requireApiAuth } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";

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

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, customer:customers(id, full_name, phone, branch_id), job:jobs(id, car:cars(id, license_plate, make, model), services:job_services(*), parts:job_parts(*)), payments:payments(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !invoice) {
    return apiError(404, "ERR_NOT_FOUND", "Invoice profile not found");
  }

  // Branch Isolation
  const invoiceRow = invoice as { branch_id: string };
  if (profile.role !== "owner" && profile.branch_id && invoiceRow.branch_id !== profile.branch_id) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden to view invoice from another branch");
  }

  interface JobRelation {
    id: string;
    car?: unknown;
    services?: unknown;
    parts?: unknown;
  }

  // Safe relation extract
  const rawJob = invoice.job as unknown as JobRelation | JobRelation[] | null;
  const job = Array.isArray(rawJob) ? rawJob[0] : rawJob;
  const car = job && typeof job === "object" && "car" in job ? (Array.isArray(job.car) ? job.car[0] : job.car) : null;
  const services = job && typeof job === "object" && "services" in job ? (Array.isArray(job.services) ? job.services : [job.services]) : [];
  const parts = job && typeof job === "object" && "parts" in job ? (Array.isArray(job.parts) ? job.parts : [job.parts]) : [];

  const formatted = {
    ...invoice,
    customer: Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer,
    job: job ? { id: job.id, car, services, parts } : null,
  };

  return apiSuccess(formatted);
}
