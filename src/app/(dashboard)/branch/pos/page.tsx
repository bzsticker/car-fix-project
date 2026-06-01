"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { CreditCard, DollarSign, LayoutGrid, Loader2, Play, Receipt } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type POSSale = {
  id: string;
  sales_number: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  customer: {
    full_name: string;
  } | null;
};

type BranchInfo = {
  id: string;
  name: string;
};

export default function POSDashboardPage() {
  const supabase = createClient();
  const [sales, setSales] = useState<POSSale[]>([]);
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPOSData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch user's profile and branch info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No authenticated session found");
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("branch_id")
        .eq("id", user.id)
        .single();

      if (profileErr || !profile?.branch_id) {
        throw new Error("Failed to resolve user branch credentials");
      }

      // Fetch branch name
      const { data: branchData, error: branchErr } = await supabase
        .from("branches")
        .select("id, name")
        .eq("id", profile.branch_id)
        .single();

      if (!branchErr && branchData) {
        setBranch(branchData);
      }

      // 2. Fetch recent POS sales for this branch
      const { data: posSales, error: salesErr } = await supabase
        .from("pos_sales")
        .select(`
          id,
          sales_number,
          total_amount,
          payment_method,
          created_at,
          customer:customers(full_name)
        `)
        .eq("branch_id", profile.branch_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (salesErr) {
        throw new Error(salesErr.message);
      }

      // Format relation helper (Supabase single relationships sometimes return array or object)
      const formattedSales = (posSales ?? []).map((s: {
        id: string;
        sales_number: string;
        total_amount: number;
        payment_method: string;
        created_at: string;
        customer: { full_name: string } | { full_name: string }[] | null;
      }) => ({
        ...s,
        customer: Array.isArray(s.customer) ? s.customer[0] : s.customer,
      }));

      setSales(formattedSales as POSSale[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cashier registry");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPOSData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPOSData]);

  // Calculate stats
  const todayStr = new Date().toDateString();
  const todaySales = sales.filter(s => new Date(s.created_at).toDateString() === todayStr);
  const todayValue = todaySales.reduce((acc, curr) => acc + Number(curr.total_amount), 0);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            RETAIL <span className="text-brand-red">POS OPERATIONS</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Storefront cash register, over-the-counter detailing parts sales for {branch?.name ?? "Branch HQ"}
          </p>
        </div>
        <Link
          href="/branch/pos/checkout"
          className="inline-flex items-center gap-2 rounded-md bg-brand-red px-5 py-3 text-sm font-semibold text-white hover:bg-brand-red-hover transition-all shadow-lg shadow-brand-red/25"
        >
          <Play size={16} fill="currentColor" /> Launch Cashier Terminal
        </Link>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">{error}</div>
      ) : null}

      {/* Overview Cards Matrix */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1 */}
        <div className="glass-card p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">TODAY&apos;S SALES VALUE</p>
            <h3 className="font-display text-2xl font-extrabold text-white">
              {todayValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-muted">THB</span>
            </h3>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded bg-brand-red/10 border border-brand-red/20 text-brand-red">
            <DollarSign size={22} />
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-card p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">TRANSACTION COUNT</p>
            <h3 className="font-display text-2xl font-extrabold text-white">
              {todaySales.length} <span className="text-xs font-normal text-muted">Checkouts</span>
            </h3>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded bg-white/5 border border-border text-white">
            <Receipt size={22} />
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-card p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">ACTIVE REGISTER</p>
            <h3 className="font-display text-2xl font-extrabold text-white text-success">
              Reg #1 - Open
            </h3>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded bg-success/10 border border-success/20 text-success">
            <LayoutGrid size={22} />
          </div>
        </div>
      </div>

      {/* Launch Box Banner */}
      <div className="glass-card p-8 bg-gradient-to-r from-card to-brand-red/5 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-l-4 border-l-brand-red">
        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold text-white uppercase tracking-wider">Checkout Terminal</h2>
          <p className="text-sm text-muted max-w-xl">
            Ring up film rolls, exhausts, ceramic coatings, or custom labor kits. Directly bills customers, prints invoices, and deducts branch inventory.
          </p>
        </div>
        <Link
          href="/branch/pos/checkout"
          className="rounded-md border border-brand-red bg-brand-red/5 px-6 py-3.5 text-center text-xs font-extrabold uppercase tracking-widest text-brand-red hover:bg-brand-red hover:text-white transition-all"
        >
          [ Open Active POS Checkout ]
        </Link>
      </div>

      {/* Recent Ledger */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-border bg-background/30 px-6 py-4">
          <h2 className="font-display text-base font-bold text-white uppercase tracking-wider">Recent Cashier Logs</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-red mr-2" />
            <span className="text-muted text-sm">Synchronizing transaction ledger...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background/40 border-b border-border">
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Sales Number</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Customer</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Date & Time</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Total Amount</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Payment Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card/10">
                {sales.length > 0 ? (
                  sales.map((sale) => (
                    <tr key={sale.id} className="transition-colors hover:bg-white/5">
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-bold text-white">
                        {sale.sales_number}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-white">
                        {sale.customer?.full_name ?? "Guest Walk-in"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-muted">
                        {new Date(sale.created_at).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-white">
                        {sale.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border font-semibold ${
                          sale.payment_method === "paid" || sale.payment_method === "bank_transfer" || sale.payment_method === "qr_payment"
                            ? "bg-success/15 border-success/35 text-success"
                            : "bg-brand-red/15 border-brand-red/35 text-brand-red"
                        }`}>
                          <CreditCard size={12} />
                          {sale.payment_method.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-muted">
                      No POS sales checked out today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
