"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Info, Loader2, Search, User } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  amount_due: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: "unpaid" | "partially_paid" | "paid" | "void";
  due_date: string;
  created_at: string;
  customer: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
};

type ProfileType = {
  role: string;
  branch_id: string | null;
};

export default function InvoicesPage() {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Profile Auth
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

      // 2. Fetch invoices via API to enforce isolation
      const branchQuery = userProfile?.branch_id ? `&filter_branch_id=${userProfile.branch_id}` : "";
      const response = await fetch(`/api/v1/invoices?limit=100${branchQuery}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to fetch invoices list");
      }
      setInvoices(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database index");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Search & filter
  const filtered = invoices.filter((item) => {
    const isMatchingStatus = !filterStatus || item.status === filterStatus;
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return isMatchingStatus;

    const matchesNumber = item.invoice_number.toLowerCase().includes(cleanSearch);
    const matchesCustomer = item.customer?.full_name.toLowerCase().includes(cleanSearch) === true;

    return isMatchingStatus && (matchesNumber || matchesCustomer);
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            INVOICES <span className="text-brand-red">LEDGER</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track customer billing statuses, record payments, and audit transactions.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">
          {error}
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center glass-card p-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search by invoice number or customer name..."
            className="brand-input w-full pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="brand-input md:w-48"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </select>
      </div>

      {/* Invoices List Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-red mr-2" />
          <span className="text-muted">Loading invoices list...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <div key={item.id} className="glass-card flex flex-col justify-between p-6 space-y-4">
                
                {/* Header info */}
                <div className="border-b border-border pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                      #{item.invoice_number}
                    </span>
                    
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      item.status === "paid"
                        ? "bg-success/15 border-success/30 text-success"
                        : item.status === "partially_paid"
                        ? "bg-warning/15 border-warning/30 text-warning"
                        : item.status === "unpaid"
                        ? "bg-brand-red/15 border-brand-red/30 text-brand-red"
                        : "bg-card border-border text-muted"
                    }`}>
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <h3 className="mt-2 font-display text-2xl font-extrabold text-white">
                    {item.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-muted">THB</span>
                  </h3>
                </div>

                {/* Metadata */}
                <div className="space-y-2 text-xs text-muted">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-muted" />
                    <div>
                      <p className="font-semibold text-white">{item.customer?.full_name}</p>
                      <p className="text-[10px]">Phone: {item.customer?.phone ?? "--"}</p>
                    </div>
                  </div>
                </div>

                {/* Expiration date */}
                <div className="flex flex-col gap-1.5 bg-background/40 border border-border/60 rounded p-3 text-xs text-muted">
                  <div className="flex justify-between">
                    <span className="text-[10px]">Amount Due:</span>
                    <span className={`font-bold ${item.amount_due > 0 ? "text-brand-red" : "text-success"}`}>
                      {item.amount_due.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border/20 pt-1 mt-1 text-[10px]">
                    <span>Due Date:</span>
                    <span>{new Date(item.due_date).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions Panel */}
                <div className="flex gap-2 border-t border-border pt-3">
                  <Link
                    href={`/branch/invoices/${item.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-border bg-card py-2 text-xs font-semibold text-white transition-all hover:bg-white/5"
                  >
                    <Info size={14} className="text-brand-red" /> View Tax Invoice
                  </Link>
                </div>

              </div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-sm text-muted">
              No invoices registered matching active filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
