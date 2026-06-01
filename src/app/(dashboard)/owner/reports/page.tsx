import { BarChart3, TrendingUp, DollarSign, ClipboardCheck, Users, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/server";

export const revalidate = 0;

type PaymentRow = {
  id: string;
  amount: number | string;
  payment_method: string;
  transaction_reference: string | null;
  payment_date: string;
  invoice_id: string;
};

type InvoiceRow = {
  id: string;
  customer_id: string;
  branch_id: string;
};

type JobRow = {
  id: string;
  status: string;
  branch_id: string;
};

type CustomerRow = {
  id: string;
  full_name: string;
};

export default async function OwnerReportsPage() {
  const supabase = createAdminClient();

  // Fetch payments, invoices, jobs, customers, and branches in parallel for supreme loading speed
  const [
    { data: payments, error: paymentsError },
    { data: invoices },
    { data: jobs },
    { data: customers },
    { data: branches }
  ] = await Promise.all([
    supabase.from("payments").select("*").order("payment_date", { ascending: false }),
    supabase.from("invoices").select("id, customer_id, branch_id").is("deleted_at", null),
    supabase.from("jobs").select("id, status, branch_id").is("deleted_at", null),
    supabase.from("customers").select("id, full_name").is("deleted_at", null),
    supabase.from("branches").select("id, name").is("deleted_at", null),
  ]);

  if (paymentsError) {
    return (
      <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-6 text-white">
        <h2 className="text-lg font-bold">Error loading reports and analysis</h2>
        <p className="text-sm text-muted">Please refresh the page or contact system support.</p>
      </div>
    );
  }

  const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const customerMap = new Map(((customers ?? []) as CustomerRow[]).map((c) => [c.id, c.full_name]));

  // Normalize payments data safely
  const normalizedPayments = ((payments ?? []) as PaymentRow[]).map((pay) => {
    const inv = (invoices as InvoiceRow[])?.find((i) => i.id === pay.invoice_id);
    const branchName = inv ? (branchMap.get(inv.branch_id) ?? "Global HQ") : "Global HQ";
    const customerName = inv ? (customerMap.get(inv.customer_id) ?? "Walk-In Customer") : "Walk-In Customer";
    return {
      ...pay,
      branchName,
      customerName,
    };
  });

  // KPI Calculations
  const totalRevenue = normalizedPayments.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalJobs = jobs?.length ?? 0;
  const completedJobs = jobs?.filter((j) => (j as JobRow).status === "completed").length ?? 0;
  const activeJobs = jobs?.filter((j) => (j as JobRow).status !== "completed" && (j as JobRow).status !== "cancelled").length ?? 0;

  // Revenue by branch calculation
  const branchRevenue: { [key: string]: number } = {};
  (branches ?? []).forEach((b) => {
    branchRevenue[b.name] = 0;
  });

  normalizedPayments.forEach((pay) => {
    if (branchRevenue[pay.branchName] !== undefined) {
      branchRevenue[pay.branchName] += Number(pay.amount);
    } else {
      branchRevenue[pay.branchName] = Number(pay.amount);
    }
  });

  // Jobs by status distribution
  const statusCounts: { [key: string]: number } = {
    draft: 0,
    scheduled: 0,
    in_progress: 0,
    qc: 0,
    completed: 0,
    cancelled: 0,
  };

  (jobs ?? []).forEach((job) => {
    const status = (job as JobRow).status;
    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    } else {
      statusCounts[status] = 1;
    }
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            REPORTS & <span className="text-brand-red">ANALYTICS</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Global revenue ledgers, workload analysis, and performance metrics</p>
        </div>
        <Link
          href="/owner"
          className="self-start rounded-md border border-border bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/10"
        >
          &larr; Back to Overview
        </Link>
      </div>

      {/* Reports KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>GLOBAL REVENUE (LIFE)</span>
            <DollarSign className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-white">
            {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-success">
            <TrendingUp size={12} />
            <span>Operational live metrics</span>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>TOTAL CUSTOMERS</span>
            <Users className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-white">{customers?.length ?? 0}</p>
          <p className="mt-2 text-xs text-muted">Registered corporate/retail clients</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>COMPLETED JOBS</span>
            <ClipboardCheck className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-white">{completedJobs} / {totalJobs}</p>
          <p className="mt-2 text-xs text-muted">Overall workshop task completion rate</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>ACTIVE DUTY WORKFLOW</span>
            <BarChart3 className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-white">{activeJobs} Pending</p>
          <p className="mt-2 text-xs text-muted">Currently active shop floor bookings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Branch Comparative Analytics */}
        <div className="glass-card p-6">
          <h2 className="mb-6 font-display text-lg font-bold text-white">REVENUE CONTRIBUTION BY BRANCH</h2>
          <div className="space-y-6">
            {Object.entries(branchRevenue).map(([branchName, amount]) => {
              const percentage = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
              return (
                <div key={branchName}>
                  <div className="mb-2 flex items-center justify-between text-sm font-medium">
                    <span className="text-white">{branchName}</span>
                    <span className="text-muted">{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-brand-red transition-all duration-500" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(branchRevenue).length === 0 ? (
              <div className="py-6 text-sm text-muted">No branch revenue figures registered.</div>
            ) : null}
          </div>
        </div>

        {/* Job Status Metrics */}
        <div className="glass-card p-6">
          <h2 className="mb-6 font-display text-lg font-bold text-white">JOB STATUS DISTRIBUTION OVERVIEW</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="rounded-md bg-white/5 p-4 border border-border/10">
                <p className="text-xs uppercase tracking-wider text-muted">{status.replace("_", " ")}</p>
                <p className="mt-2 font-display text-2xl font-extrabold text-white">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Global Revenue Ledger */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">GLOBAL OPERATIONS REVENUE LEDGER</h2>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <ShieldCheck size={12} className="text-success" />
            <span>Audit-ready invoices</span>
          </span>
        </div>

        {normalizedPayments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Wallet className="mb-4 text-muted" size={48} />
            <h3 className="text-lg font-bold text-white">No Transactions Recorded</h3>
            <p className="mt-1 text-sm text-muted">Completed workshop invoice payments will display in this ledger.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-muted">
              <thead className="bg-white/5 text-xs font-semibold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-6 py-4">Client Member</th>
                  <th className="px-6 py-4">Branch Location</th>
                  <th className="px-6 py-4">Txn Reference</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {normalizedPayments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-white/2 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 font-semibold text-white">
                      {pay.customerName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-white">
                      {pay.branchName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-white">
                      {pay.transaction_reference ?? "N/A"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {new Date(pay.payment_date).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 uppercase text-xs font-bold text-white">
                      {pay.payment_method.replace("_", " ")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-display font-extrabold text-white">
                      {Number(pay.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
