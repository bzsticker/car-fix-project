import { AlertTriangle, Clipboard, DollarSign, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

type PaymentRow = {
  amount: number | string;
};

type AttendanceRow = {
  id: string;
  clock_in: string;
  profile: { full_name: string } | { full_name: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export const revalidate = 0;

export default async function OwnerPage() {
  const supabase = await createClient();
  const [{ count: branchCount }, { count: jobsCount }, { data: payments }, { data: activeAttendance }] = await Promise.all([
    supabase.from("branches").select("*", { count: "exact", head: true }),
    supabase.from("jobs").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("payments").select("amount"),
    supabase.from("attendance_logs").select("id, clock_in, profile:profiles(full_name)").is("clock_out", null),
  ]);

  const totalRevenue =
    payments?.reduce((accumulator, payment) => accumulator + Number((payment as PaymentRow).amount), 0) ?? 0;

  const normalizedAttendance = ((activeAttendance ?? []) as AttendanceRow[]).map((log) => ({
    ...log,
    profile: firstRelation(log.profile),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
          OWNER <span className="text-brand-red">HQ BOARD</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Global operations and multi-branch performance dashboard</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">GLOBAL REVENUE (MTD)</span>
            <DollarSign className="text-brand-red" size={20} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-white">
              {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-sm font-semibold text-success">Live</span>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-brand-red" style={{ width: "65%" }} />
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">TOTAL ACTIVE JOBS</span>
            <Clipboard className="text-brand-red" size={20} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-white">{jobsCount ?? 0} Active</span>
          </div>
          <p className="mt-1 text-xs text-muted">Across {branchCount ?? 0} active branches</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">STAFF SHIFT CLOCKS</span>
            <Users className="text-brand-red" size={20} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-white">
              {normalizedAttendance.length} Clocked
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">Today&apos;s active timesheet logs</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">STOCK ALERTS</span>
            <AlertTriangle className="text-warning" size={20} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-white">3 Alerts</span>
          </div>
          <p className="mt-1 text-xs text-muted">Low inventory stock level thresholds</p>
        </div>
      </div>

      <div className="glass-card p-8">
        <h2 className="mb-6 font-display text-xl font-bold text-white">BRANCH PERFORMANCE OVERVIEW</h2>
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex justify-between text-sm font-medium">
              <span className="text-white">Bangkok HQ Branch</span>
              <span className="text-muted">260,000.00 THB MTD</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-brand-red" style={{ width: "67%" }} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-sm font-medium">
              <span className="text-white">Pathum Thani Outpost</span>
              <span className="text-muted">125,450.00 THB MTD</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-brand-red/60" style={{ width: "33%" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">TODAY&apos;S SHIFT CLOCKS</h2>
          <div className="divide-y divide-border">
            {normalizedAttendance.length > 0 ? (
              normalizedAttendance.map((log) => (
                <div key={log.id} className="flex justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{log.profile?.full_name ?? "Unknown Staff"}</p>
                    <p className="text-xs text-muted">
                      Clock-in: {new Date(log.clock_in).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-md border border-success/20 bg-success/10 px-2 py-1 text-xs font-medium text-success">
                    On Duty
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-sm text-muted">No active attendance logs yet.</div>
            )}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">STOCK LEVEL WARNINGS</h2>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-white">Akrapovic FL5 Exhaust</p>
                <p className="text-xs text-muted">SKU: EXH-AKRAP-EVO (Bangkok HQ)</p>
              </div>
              <span className="inline-flex items-center rounded border border-brand-red/20 bg-brand-red/10 px-2 py-0.5 text-xs font-semibold text-brand-red">
                Out of Stock (0/1)
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-white">3M Satin Black Wrap</p>
                <p className="text-xs text-muted">SKU: WRAP-3M-SATINBLK (Pathum Thani)</p>
              </div>
              <span className="inline-flex items-center rounded border border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                Low Stock (1/2)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
