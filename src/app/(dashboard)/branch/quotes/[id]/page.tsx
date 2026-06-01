"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, Printer, ShieldAlert, Wrench, XCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  item_type: "service" | "part";
};

type Quote = {
  id: string;
  branch_id: string;
  customer_id: string;
  car_id: string;
  status: "draft" | "sent" | "approved" | "rejected" | "expired";
  valid_until: string;
  total_amount: number;
  created_at: string;
  job_id: string | null;
  customer: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
  car: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
  } | null;
  items: QuoteItem[];
};

type ProfileType = {
  role: string;
  branch_id: string | null;
};

export default function QuoteDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [quote, setQuote] = useState<Quote | null>(null);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        setProfile(userProfile);
      }

      // 2. Fetch specific quote details via API
      const response = await fetch(`/api/v1/quotes/${id}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Estimate profile not found");
      }
      setQuote(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database details");
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleUpdateStatus = async (newStatus: "sent" | "rejected") => {
    setUpdating(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/v1/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to update estimate status");
      }

      setSuccess(`Quotation status updated to ${newStatus}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleConvertToJob = async () => {
    if (!quote) return;
    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Create repair job card via API
      const jobResponse = await fetch("/api/v1/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: quote.customer_id,
          car_id: quote.car_id,
          notes: `[Auto-created from Approved Estimate Sheet: #QTE-${quote.id.slice(0, 8).toUpperCase()}] Items total amount: ${quote.total_amount.toLocaleString()} THB`,
        }),
      });

      const jobPayload = await jobResponse.json();
      if (!jobResponse.ok) {
        throw new Error(jobPayload.error?.message ?? "Failed to initialize active Job Ticket");
      }

      const jobId = jobPayload.data.id;

      // 2. Bind Job ID and mark Quote as approved
      const quoteResponse = await fetch(`/api/v1/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          job_id: jobId,
        }),
      });

      const quotePayload = await quoteResponse.json();
      if (!quoteResponse.ok) {
        throw new Error(quotePayload.error?.message ?? "Failed to bind estimate sheet to Job");
      }

      setSuccess("Estimate approved successfully! Active Job Card opened for workshop execution.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve estimate");
    } finally {
      setUpdating(false);
    }
  };

  const isReadOnly = profile?.role === "technician";
  const isExpired = quote ? new Date(quote.valid_until) < new Date() : false;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="animate-spin text-brand-red" size={32} />
        <span className="text-muted text-sm">Loading estimated quote sheet...</span>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="space-y-4 py-8">
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white flex items-center gap-3">
          <ShieldAlert className="text-brand-red" />
          <span>{error ?? "Requested quotation sheet profile does not exist."}</span>
        </div>
        <button
          onClick={() => router.push("/branch/quotes")}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
        >
          <ArrowLeft size={14} /> Back to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/branch/quotes")}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
        >
          <ArrowLeft size={14} /> Back to Ledger
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-white/5"
          >
            <Printer size={14} /> Print Document
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="rounded-md border border-success/30 bg-success/10 p-4 text-sm text-white">
          {success}
        </div>
      )}

      {/* Main Quote Sheet Document Container */}
      <div className="glass-card p-8 space-y-8 bg-[#111111] print:bg-white print:text-black print:p-0 print:border-none print:shadow-none">
        
        {/* Header - Brand seal and dates */}
        <div className="flex flex-col justify-between gap-6 border-b border-border pb-6 sm:flex-row sm:items-start">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white print:text-black">
              DEN <span className="text-brand-red">MODIFY</span>
            </h1>
            <p className="text-xs text-muted print:text-black/80">
              123 Srinakarin Rd, Nong Bon, Prawet, Bangkok 10250
            </p>
          </div>

          <div className="text-left sm:text-right space-y-1 text-xs text-muted print:text-black/80">
            <p className="font-bold text-white print:text-black text-sm uppercase">ESTIMATE / QUOTATION</p>
            <p>QUOTE ID: <span className="font-mono text-white print:text-black">#QTE-{quote.id.slice(0, 8).toUpperCase()}</span></p>
            <p>Issue Date: {new Date(quote.created_at).toLocaleDateString()}</p>
            <p className={`font-semibold ${isExpired ? "text-brand-red" : "text-white print:text-black"}`}>
              Valid Until: {new Date(quote.valid_until).toLocaleDateString()} {isExpired && "(Expired)"}
            </p>
          </div>
        </div>

        {/* Client & Car details mapping */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 border-b border-border pb-6">
          <div className="space-y-1 text-xs">
            <p className="font-bold text-white print:text-black uppercase text-[10px] tracking-wider text-muted">BILLED TO:</p>
            <p className="font-semibold text-white print:text-black text-sm">{quote.customer?.full_name}</p>
            <p className="text-muted print:text-black/80">Phone: {quote.customer?.phone}</p>
          </div>

          <div className="space-y-1 text-xs">
            <p className="font-bold text-white print:text-black uppercase text-[10px] tracking-wider text-muted">VEHICLE DETAILS:</p>
            <p className="font-semibold text-white print:text-black text-sm uppercase">{quote.car?.license_plate}</p>
            <p className="text-muted print:text-black/80">{quote.car?.make} {quote.car?.model}</p>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-white print:text-black uppercase tracking-wider text-muted">ITEMIZED COST ESTIMATES</h2>
          
          <div className="border border-border/80 rounded overflow-hidden print:border-black/30">
            <table className="w-full text-left text-xs text-muted print:text-black">
              <thead className="bg-background text-[10px] font-bold uppercase tracking-wider text-white border-b border-border/80 print:bg-black/10 print:text-black print:border-black/30">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price (THB)</th>
                  <th className="px-4 py-3 text-right">Total Price (THB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 print:divide-black/20">
                {quote.items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.01]">
                    <td className="px-4 py-3.5 font-medium text-white print:text-black">{item.description}</td>
                    <td className="px-4 py-3.5 text-center capitalize">{item.item_type}</td>
                    <td className="px-4 py-3.5 text-center font-mono">{item.quantity}</td>
                    <td className="px-4 py-3.5 text-right font-mono">{item.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-white print:text-black font-semibold">
                      {item.total_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing Summary & Stamp */}
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between items-end border-t border-border pt-6">
          <div className="text-xs text-muted print:text-black/80 flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-border bg-background">
              STATUS: {quote.status.toUpperCase()}
            </span>
            {quote.job_id && (
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-success/30 bg-success/15 text-success">
                JOB LOCKED
              </span>
            )}
          </div>

          <div className="w-full sm:w-64 space-y-1.5 text-xs text-muted print:text-black">
            <div className="flex justify-between font-semibold text-white print:text-black text-sm">
              <span>ESTIMATED TOTAL:</span>
              <span className="font-display font-bold">
                {quote.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB
              </span>
            </div>
            <p className="text-[10px] text-right text-muted italic print:text-black/85">
              Prices exclude VAT. Subject to full terms and conditions.
            </p>
          </div>
        </div>

      </div>

      {/* Control Actions Panel (Hidden during printing) */}
      {!isReadOnly && !updating && (
        <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <h4 className="text-sm font-bold text-white uppercase mb-1">QUOTATION WORKFLOW MANAGER</h4>
            <p className="text-xs text-muted">Update status or execute final conversion transitions.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {quote.status === "draft" && (
              <>
                <button
                  onClick={() => handleUpdateStatus("sent")}
                  className="rounded bg-brand-red px-4 py-2 text-xs font-bold text-white hover:bg-brand-red-hover"
                >
                  Mark as Sent to LINE OA
                </button>
                <button
                  onClick={() => handleUpdateStatus("rejected")}
                  className="rounded border border-border bg-card px-4 py-2 text-xs font-semibold text-muted hover:text-white"
                >
                  Reject Estimate
                </button>
              </>
            )}

            {quote.status === "sent" && (
              <>
                <button
                  onClick={handleConvertToJob}
                  className="inline-flex items-center gap-1.5 rounded bg-brand-red px-4 py-2 text-xs font-bold text-white hover:bg-brand-red-hover"
                >
                  <Wrench size={12} /> Approve & Convert to Job
                </button>
                
                <button
                  onClick={() => handleUpdateStatus("rejected")}
                  className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-4 py-2 text-xs font-semibold text-muted hover:text-white"
                >
                  <XCircle size={12} /> Reject Quote
                </button>
              </>
            )}

            {quote.status === "approved" && quote.job_id && (
              <p className="text-xs text-success font-semibold flex items-center gap-1.5">
                <CheckCircle size={16} /> Bounded to Active Repair Ticket: #{quote.job_id.slice(0, 8).toUpperCase()}
              </p>
            )}

            {(quote.status === "rejected" || quote.status === "expired" || isExpired) && (
              <p className="text-xs text-muted italic">
                {isExpired ? "This quotation estimate has expired." : "This estimate sheet has been archived."}
              </p>
            )}
          </div>
        </div>
      )}

      {updating && (
        <div className="glass-card p-6 flex justify-center items-center py-8 print:hidden">
          <Loader2 className="animate-spin text-brand-red mr-2" />
          <span className="text-sm text-muted">Updating database transactions...</span>
        </div>
      )}
    </div>
  );
}
