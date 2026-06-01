"use client";

import React, { useEffect, useState } from "react";
import { BarChart3, Calendar, Clock, DollarSign, Loader2, ShieldAlert, ShieldCheck, Truck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type RevenueReport = {
  branch_id: string;
  total_invoiced: number;
  total_received: number;
  total_tax: number;
  total_discount: number;
  total_outstanding: number;
  payments_by_method: Record<string, number>;
  invoice_count: number;
  payment_count: number;
};

type JobReport = {
  branch_id: string;
  total_jobs: number;
  by_status: Record<string, number>;
  completed_jobs_count: number;
  average_job_duration_minutes: number;
};

type InventoryReport = {
  branch_id: string;
  total_items_in_stock: number;
  unique_skus_count: number;
  stock_valuation_cost: number;
  stock_valuation_retail: number;
  low_stock_items_count: number;
  valuation_by_category: Record<string, { cost: number; retail: number; items: number }>;
};

type WarrantyReport = {
  branch_id: string;
  total_warranties_count: number;
  total_claims_count: number;
  defect_rate_percent: number;
  claims_by_status: Record<string, number>;
};

type ProfileType = {
  role: string;
  branch_id: string | null;
};

export default function ReportsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytical report states
  const [revenueData, setRevenueData] = useState<RevenueReport | null>(null);
  const [jobData, setJobData] = useState<JobReport | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryReport | null>(null);
  const [warrantyData, setWarrantyData] = useState<WarrantyReport | null>(null);

  // Date Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to start of current month
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Auth Profile
      const { data: { user } } = await supabase.auth.getUser();
      let userProfile: ProfileType | null = null;
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role, branch_id")
          .eq("id", user.id)
          .single();
        userProfile = data as ProfileType;
      }

      // 2. Fetch all reports simultaneously with date filters
      const branchQuery = userProfile?.branch_id ? `&filter_branch_id=${userProfile.branch_id}` : "";
      const dateParams = `&start_date=${startDate}T00:00:00.000Z&end_date=${endDate}T23:59:59.999Z`;

      const [revRes, jobRes, invRes, wrRes] = await Promise.all([
        fetch(`/api/v1/reports/revenue?${branchQuery}${dateParams}`),
        fetch(`/api/v1/reports/jobs?${branchQuery}${dateParams}`),
        fetch(`/api/v1/reports/inventory?${branchQuery}`), // Inventory valuation is current
        fetch(`/api/v1/reports/warranties?${branchQuery}`), // Warranty metrics is cumulative
      ]);

      const [revPayload, jobPayload, invPayload, wrPayload] = await Promise.all([
        revRes.json(),
        jobRes.json(),
        invRes.json(),
        wrRes.json(),
      ]);

      if (!revRes.ok) throw new Error(revPayload.error?.message ?? "Failed to fetch revenue analytics");
      if (!jobRes.ok) throw new Error(jobPayload.error?.message ?? "Failed to fetch job performance metrics");
      if (!invRes.ok) throw new Error(invPayload.error?.message ?? "Failed to fetch inventory stock valuation");
      if (!wrRes.ok) throw new Error(wrPayload.error?.message ?? "Failed to fetch warranty defects index");

      setRevenueData(revPayload.data);
      setJobData(jobPayload.data);
      setInventoryData(invPayload.data);
      setWarrantyData(wrPayload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database reports dashboard");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="animate-spin text-brand-red" size={32} />
        <span className="text-muted text-sm font-semibold">Generating business analytical reports...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-8 max-w-4xl mx-auto">
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white flex items-center gap-3">
          <ShieldAlert className="text-brand-red" />
          <span>{error ?? "Requested analytics engine is unavailable."}</span>
        </div>
      </div>
    );
  }

  // Helper variables for widgets
  const cashReceived = revenueData?.total_received ?? 0;
  const completedJobs = jobData?.completed_jobs_count ?? 0;
  const stockValue = inventoryData?.stock_valuation_retail ?? 0;
  const activeWarranties = warrantyData?.total_warranties_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            REPORTS & <span className="text-brand-red">ANALYTICS</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Monitor real-time revenue, workshop efficiencies, inventory valuation, and defects.
          </p>
        </div>
      </div>

      {/* Date Range Selector Panel */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center glass-card p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase">
          <Calendar size={14} className="text-brand-red" />
          <span>Select Date Range MTD:</span>
        </div>

        <div className="flex flex-1 gap-2 flex-col sm:flex-row">
          <input
            type="date"
            className="brand-input flex-1 font-mono text-xs"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            className="brand-input flex-1 font-mono text-xs"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <button
          onClick={() => void loadData()}
          className="inline-flex items-center justify-center gap-1.5 rounded bg-brand-red px-4 py-2 text-xs font-bold text-white hover:bg-brand-red-hover transition-all"
        >
          Generate Report
        </button>
      </div>

      {/* Core Dashboard KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded bg-[#C40000]/10 p-3 text-brand-red">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-wider">CASH RECEIVED (MTD)</p>
            <h3 className="font-display text-2xl font-extrabold text-white mt-0.5">
              {cashReceived.toLocaleString()} <span className="text-xs font-normal text-muted">THB</span>
            </h3>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded bg-success/10 p-3 text-success">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-wider">COMPLETED JOBS (MTD)</p>
            <h3 className="font-display text-2xl font-extrabold text-white mt-0.5">
              {completedJobs} Jobs
            </h3>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded bg-warning/10 p-3 text-warning">
            <Truck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-wider">STOCK VALUATION (RETAIL)</p>
            <h3 className="font-display text-2xl font-extrabold text-white mt-0.5">
              {stockValue.toLocaleString()} <span className="text-xs font-normal text-muted">THB</span>
            </h3>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded bg-success/10 p-3 text-success">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-wider">ACTIVE WARRANTIES</p>
            <h3 className="font-display text-2xl font-extrabold text-white mt-0.5">
              {activeWarranties} Sheets
            </h3>
          </div>
        </div>
      </div>

      {/* Main Reports Matrix Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        
        {/* 1. Revenue & Payment Methods Ledger Card */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <DollarSign className="text-brand-red" size={18} />
            <h2 className="font-display text-lg font-bold text-white uppercase tracking-tight">Revenue Ledger Summary</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">TOTAL INVOICED MTD</p>
              <p className="font-mono text-base font-bold text-white mt-1">{(revenueData?.total_invoiced ?? 0).toLocaleString()} THB</p>
            </div>
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">ACTUAL CASH RECEIVED</p>
              <p className="font-mono text-base font-bold text-success mt-1">{(revenueData?.total_received ?? 0).toLocaleString()} THB</p>
            </div>
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">VAT 7% LIABILITY</p>
              <p className="font-mono text-base font-bold text-white mt-1">{(revenueData?.total_tax ?? 0).toLocaleString()} THB</p>
            </div>
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">DISCOUNTS APPLIED</p>
              <p className="font-mono text-base font-bold text-brand-red mt-1">{(revenueData?.total_discount ?? 0).toLocaleString()} THB</p>
            </div>
          </div>

          {/* Payment Methods breakdown */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[10px] font-extrabold text-muted uppercase tracking-wider">CASH FLOW BY PAYMENT METHOD</h3>
            
            <div className="space-y-2 text-xs">
              {revenueData && Object.entries(revenueData.payments_by_method).length > 0 ? (
                Object.entries(revenueData.payments_by_method).map(([method, val]) => {
                  const pct = cashReceived > 0 ? (val / cashReceived) * 100 : 0;
                  return (
                    <div key={method} className="space-y-1 bg-background/25 border border-border/40 p-2.5 rounded">
                      <div className="flex justify-between font-semibold">
                        <span className="capitalize">{method.replace(/_/g, " ")}</span>
                        <span className="font-mono">{val.toLocaleString()} THB ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1 w-full bg-border rounded overflow-hidden">
                        <div className="h-full bg-brand-red" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center italic text-muted py-4">No cash receipts registered in selected range.</p>
              )}
            </div>
          </div>
        </div>

        {/* 2. Job Performance Efficiency Card */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <BarChart3 className="text-brand-red" size={18} />
            <h2 className="font-display text-lg font-bold text-white uppercase tracking-tight">Workshop Job Performance</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">TOTAL ACTIVE TICKETS</p>
              <p className="font-mono text-base font-bold text-white mt-1">{(jobData?.total_jobs ?? 0)} Job Sheets</p>
            </div>
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">AVERAGE JOB TIMING</p>
              <p className="font-mono text-base font-bold text-warning mt-1">
                {jobData && jobData.average_job_duration_minutes > 0 
                  ? `${Math.round(jobData.average_job_duration_minutes / 60)} Hours`
                  : "--"}
              </p>
            </div>
          </div>

          {/* Job status breakdown */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[10px] font-extrabold text-muted uppercase tracking-wider">PIPELINE JOBS STATUS BREAKDOWN</h3>
            
            <div className="border border-border/80 rounded overflow-hidden">
              <table className="w-full text-left text-xs text-muted">
                <thead className="bg-background text-[10px] font-bold uppercase tracking-wider text-white border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2">Workflow Status</th>
                    <th className="px-4 py-2 text-right">Job Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {jobData && Object.entries(jobData.by_status).length > 0 ? (
                    Object.entries(jobData.by_status).map(([status, cnt]) => (
                      <tr key={status}>
                        <td className="px-4 py-2 capitalize font-medium text-white">{status.replace(/_/g, " ")}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold">{cnt} Jobs</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-center italic text-muted">
                        No active jobs in the selected timeline.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. Inventory Stock Valuation Card */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Truck className="text-brand-red" size={18} />
            <h2 className="font-display text-lg font-bold text-white uppercase tracking-tight">Stock Valuation & Alerts</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">STOCK VALUATION (COST)</p>
              <p className="font-mono text-base font-bold text-white mt-1">{(inventoryData?.stock_valuation_cost ?? 0).toLocaleString()} THB</p>
            </div>
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">STOCK VALUATION (RETAIL)</p>
              <p className="font-mono text-base font-bold text-success mt-1">{(inventoryData?.stock_valuation_retail ?? 0).toLocaleString()} THB</p>
            </div>
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">ACTIVE SKUs COUNT</p>
              <p className="font-mono text-base font-bold text-white mt-1">{(inventoryData?.unique_skus_count ?? 0)} SKUs</p>
            </div>
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">CRITICAL LOW STOCK</p>
              <p className={`font-mono text-base font-bold mt-1 ${(inventoryData?.low_stock_items_count ?? 0) > 0 ? "text-warning font-extrabold" : "text-success"}`}>
                {(inventoryData?.low_stock_items_count ?? 0)} SKUs
              </p>
            </div>
          </div>

          {/* Stock by Category table */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[10px] font-extrabold text-muted uppercase tracking-wider">STOCK VALUATION BY CATEGORY</h3>
            
            <div className="border border-border/80 rounded overflow-hidden">
              <table className="w-full text-left text-xs text-muted">
                <thead className="bg-background text-[10px] font-bold uppercase tracking-wider text-white border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2 text-center">Items (Qty)</th>
                    <th className="px-4 py-2 text-right">Retail Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {inventoryData && Object.entries(inventoryData.valuation_by_category).length > 0 ? (
                    Object.entries(inventoryData.valuation_by_category).map(([cat, val]) => (
                      <tr key={cat}>
                        <td className="px-4 py-2 capitalize font-medium text-white">{cat.replace(/_/g, " ")}</td>
                        <td className="px-4 py-2 text-center font-mono">{val.items}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-success">{val.retail.toLocaleString()} THB</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center italic text-muted">
                        No inventories stocked in the database catalog.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 4. Warranty & Claims Analytics Card */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <ShieldCheck className="text-brand-red" size={18} />
            <h2 className="font-display text-lg font-bold text-white uppercase tracking-tight">Warranty Defects Analytics</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">WARRANTIES REGISTERED</p>
              <p className="font-mono text-base font-bold text-white mt-1">{(warrantyData?.total_warranties_count ?? 0)} Sheets</p>
            </div>
            <div className="bg-background/40 border border-border p-3 rounded">
              <p className="text-[9px] font-extrabold text-muted uppercase">DEFECTS CLAIM RATE %</p>
              <p className={`font-mono text-base font-bold mt-1 ${(warrantyData?.defect_rate_percent ?? 0) > 8 ? "text-brand-red" : "text-success"}`}>
                {(warrantyData?.defect_rate_percent ?? 0).toFixed(1)}% ({warrantyData?.total_claims_count} claims)
              </p>
            </div>
          </div>

          {/* Claims Status breakdown table */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[10px] font-extrabold text-muted uppercase tracking-wider">DEFECT CLAIMS WORKFLOW COUNT</h3>
            
            <div className="border border-border/80 rounded overflow-hidden">
              <table className="w-full text-left text-xs text-muted">
                <thead className="bg-background text-[10px] font-bold uppercase tracking-wider text-white border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2">Claim Status</th>
                    <th className="px-4 py-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {warrantyData && Object.entries(warrantyData.claims_by_status).length > 0 ? (
                    Object.entries(warrantyData.claims_by_status).map(([status, cnt]) => (
                      <tr key={status}>
                        <td className="px-4 py-2 capitalize font-medium text-white">{status}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold">{cnt} Claims</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-center italic text-muted">
                        No defect claims registered in database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
