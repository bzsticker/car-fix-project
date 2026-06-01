import { Calendar, ClipboardList, ShieldAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

type BranchRelation = { name: string } | { name: string }[] | null;
type ProfileRow = {
  branch_id: string | null;
  branch: BranchRelation;
};

type JobRow = {
  id: string;
  status: string;
  car: { license_plate: string; make: string; model: string } | { license_plate: string; make: string; model: string }[] | null;
  customer: { full_name: string } | { full_name: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export const revalidate = 0;

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("branch_id, branch:branches(name)")
    .eq("id", user?.id)
    .single<ProfileRow>();

  const branch = firstRelation(profile?.branch ?? null);
  const branchId = profile?.branch_id ?? null;

  const { data: jobs } = branchId
    ? await supabase
        .from("jobs")
        .select("id, status, car:cars(license_plate, make, model), customer:customers(full_name)")
        .eq("branch_id", branchId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(3)
    : { data: [] as JobRow[] };

  const { data: appointments } = branchId
    ? await supabase
        .from("appointments")
        .select("id")
        .eq("branch_id", branchId)
        .eq("status", "pending")
        .is("deleted_at", null)
    : { data: [] as { id: string }[] };

  const normalizedJobs = (jobs ?? []).map((job) => ({
    ...job,
    car: firstRelation(job.car),
    customer: firstRelation(job.customer),
  }));

  const activeJobsCount = normalizedJobs.filter((job) => !["completed", "cancelled"].includes(job.status)).length;
  const pendingBookings = appointments?.length ?? 0;
  const branchName = branch?.name ?? "Unassigned Branch";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            BRANCH <span className="text-brand-red">COCKPIT</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Managing: <span className="font-semibold text-white">{branchName}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] hover:bg-brand-red-hover">
            + New Job Ticket
          </button>
          <button className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/5">
            Launch POS Checkout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">ACTIVE JOBS PIPELINE</span>
            <ClipboardList className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">{activeJobsCount} Vehicles</p>
          <p className="mt-1 text-xs text-muted">Currently in work stages</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">PENDING BOOKINGS</span>
            <Calendar className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">{pendingBookings} Appointments</p>
          <p className="mt-1 text-xs text-muted">Awaiting confirmation sync</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">STOCK ALERTS</span>
            <ShieldAlert className="text-warning" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">1 Low SKU</p>
          <p className="mt-1 text-xs text-muted">Requires procurement reorder</p>
        </div>
      </div>

      <div className="glass-card p-8">
        <h2 className="mb-6 font-display text-xl font-bold text-white">WORKSHOP KANBAN WORKFLOW</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {normalizedJobs.length > 0 ? (
            normalizedJobs.map((job) => (
              <div key={job.id} className="rounded-lg border border-border bg-background p-4">
                <div className="border-b border-border pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-red">
                    {job.car?.license_plate ?? "Unknown Plate"}
                  </span>
                  <h3 className="mt-1 text-sm font-semibold text-white">
                    {job.car?.make ?? "Unknown"} {job.car?.model ?? ""}
                  </h3>
                  <p className="text-xs text-muted">Owner: {job.customer?.full_name ?? "Unknown Customer"}</p>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted">Current Stage</span>
                  <span className="font-semibold capitalize text-white">{job.status.replaceAll("_", " ")}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted">
              No branch jobs are available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
