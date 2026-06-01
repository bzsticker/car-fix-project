"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Loader2, Printer, ShieldAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type JobService = {
  id: string;
  name: string;
  price: number;
};

type JobPart = {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type Payment = {
  id: string;
  amount: number;
  payment_method: "cash" | "credit_card" | "bank_transfer" | "qr_payment";
  transaction_reference: string | null;
  payment_date: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
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
  job: {
    id: string;
    car: {
      id: string;
      license_plate: string;
      make: string;
      model: string;
    } | null;
    services: JobService[];
    parts: JobPart[];
  } | null;
  payments: Payment[];
};

type ProfileType = {
  role: string;
  branch_id: string | null;
};

export default function InvoiceDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<"cash" | "credit_card" | "bank_transfer" | "qr_payment">("bank_transfer");
  const [payRef, setPayRef] = useState("");

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
        setProfile(userProfile);
      }

      // 2. Fetch specific invoice detail via API
      const response = await fetch(`/api/v1/invoices/${id}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Invoice sheet not found");
      }
      setInvoice(payload.data);
      // Pre-fill maximum payable amount
      setPayAmount(payload.data.amount_due);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database invoice");
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

  const handleRecordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!invoice) return;

    if (payAmount <= 0) {
      setError("Payment amount must be greater than zero.");
      setSubmitting(false);
      return;
    }

    if (payAmount > invoice.amount_due) {
      setError(`Payment exceeds the maximum amount due (${invoice.amount_due.toLocaleString()} THB).`);
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/v1/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: id,
          amount: payAmount,
          payment_method: payMethod,
          transaction_reference: payRef || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to register payment");
      }

      setSuccess(`Payment of ${payAmount.toLocaleString()} THB recorded successfully!`);
      setModalOpen(false);
      setPayRef("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = profile?.role === "technician";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="animate-spin text-brand-red" size={32} />
        <span className="text-muted text-sm">Loading tax invoice / receipt...</span>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4 py-8">
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white flex items-center gap-3">
          <ShieldAlert className="text-brand-red" />
          <span>{error ?? "Requested invoice profile does not exist."}</span>
        </div>
        <button
          onClick={() => router.push("/branch/invoices")}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
        >
          <ArrowLeft size={14} /> Back to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation Headers */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/branch/invoices")}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
        >
          <ArrowLeft size={14} /> Back to Ledger
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-white/5"
          >
            <Printer size={14} /> Print Receipt
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="rounded-md border border-success/30 bg-success/10 p-4 text-sm text-white">
          {success}
        </div>
      )}

      {/* Tax Invoice Document Box */}
      <div className="glass-card p-8 space-y-8 bg-[#111111] print:bg-white print:text-black print:p-0 print:border-none print:shadow-none">
        
        {/* Document Header */}
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
            <p className="font-bold text-white print:text-black text-sm uppercase">TAX INVOICE / RECEIPT</p>
            <p>INVOICE NO: <span className="font-mono text-white print:text-black font-semibold">#{invoice.invoice_number}</span></p>
            <p>Issue Date: {new Date(invoice.created_at).toLocaleDateString()}</p>
            <p className="font-semibold text-white print:text-black">
              Due Date: {new Date(invoice.due_date).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Billed profiles */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 border-b border-border pb-6">
          <div className="space-y-1 text-xs">
            <p className="font-bold text-white print:text-black uppercase text-[10px] tracking-wider text-muted">BILLED TO:</p>
            <p className="font-semibold text-white print:text-black text-sm">{invoice.customer?.full_name}</p>
            <p className="text-muted print:text-black/80">Phone: {invoice.customer?.phone}</p>
          </div>

          {invoice.job?.car && (
            <div className="space-y-1 text-xs">
              <p className="font-bold text-white print:text-black uppercase text-[10px] tracking-wider text-muted">VEHICLE DETAILS:</p>
              <p className="font-semibold text-white print:text-black text-sm uppercase">{invoice.job.car.license_plate}</p>
              <p className="text-muted print:text-black/80">{invoice.job.car.make} {invoice.job.car.model}</p>
            </div>
          )}
        </div>

        {/* Itemized pricing details table */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-white print:text-black uppercase tracking-wider text-muted">INVOICED LINE ITEMS</h2>
          
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
                {/* 1. Services rows */}
                {invoice.job?.services.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.01]">
                    <td className="px-4 py-3.5 font-medium text-white print:text-black">{item.name}</td>
                    <td className="px-4 py-3.5 text-center">Service</td>
                    <td className="px-4 py-3.5 text-center font-mono">1</td>
                    <td className="px-4 py-3.5 text-right font-mono">{item.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-white print:text-black font-semibold">
                      {item.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}

                {/* 2. Parts rows */}
                {invoice.job?.parts.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.01]">
                    <td className="px-4 py-3.5 font-medium text-white print:text-black">Workshop consumed materials (Ref ID: {item.id.slice(0, 8).toUpperCase()})</td>
                    <td className="px-4 py-3.5 text-center">Part</td>
                    <td className="px-4 py-3.5 text-center font-mono">{item.quantity}</td>
                    <td className="px-4 py-3.5 text-right font-mono">{item.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-white print:text-black font-semibold">
                      {item.total_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}

                {/* No items fallback */}
                {(!invoice.job || (invoice.job.services.length === 0 && invoice.job.parts.length === 0)) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted italic">
                      Retail point-of-sale itemizations (Bound PosSale record).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calculations total sum block */}
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between items-start pt-4 border-t border-border">
          <div className="space-y-1 text-xs text-muted print:text-black/80">
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-border bg-background">
              STATUS: {invoice.status.toUpperCase()}
            </span>
          </div>

          <div className="w-full sm:w-64 text-xs text-muted print:text-black space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono">{(invoice.total_amount - invoice.tax_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} THB</span>
            </div>
            <div className="flex justify-between border-b border-border/40 pb-1.5 print:border-black/20">
              <span>VAT (7%):</span>
              <span className="font-mono">{invoice.tax_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB</span>
            </div>
            <div className="flex justify-between font-semibold text-white print:text-black text-sm">
              <span>TOTAL INVOICED:</span>
              <span className="font-display font-bold">{invoice.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB</span>
            </div>
            <div className="flex justify-between font-bold text-brand-red text-xs pt-1">
              <span>OUTSTANDING AMOUNT DUE:</span>
              <span className="font-mono">{invoice.amount_due.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB</span>
            </div>
          </div>
        </div>

        {/* Payments History section */}
        <div className="border-t border-border pt-6 space-y-3 print:border-black/30">
          <h2 className="text-xs font-bold text-white print:text-black uppercase tracking-wider text-muted">PAYMENTS HISTORY LOGS</h2>
          
          <div className="border border-border/80 rounded overflow-hidden print:border-black/30">
            <table className="w-full text-left text-xs text-muted print:text-black">
              <thead className="bg-background text-[10px] font-bold uppercase tracking-wider text-white border-b border-border/80 print:bg-black/10 print:text-black print:border-black/30">
                <tr>
                  <th className="px-4 py-2.5">Date Registered</th>
                  <th className="px-4 py-2.5">Method</th>
                  <th className="px-4 py-2.5">Reference Code</th>
                  <th className="px-4 py-2.5 text-right">Amount (THB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 print:divide-black/20">
                {invoice.payments.length > 0 ? (
                  invoice.payments.map((pmt) => (
                    <tr key={pmt.id}>
                      <td className="px-4 py-3">{new Date(pmt.payment_date).toLocaleString()}</td>
                      <td className="px-4 py-3 capitalize">{pmt.payment_method.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-mono">{pmt.transaction_reference ?? "--"}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-white print:text-black">
                        {pmt.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center italic text-muted">
                      No payments recorded yet. Pending settlement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Control Action workflow panel */}
      {!isReadOnly && invoice.amount_due > 0 && (
        <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <h4 className="text-sm font-bold text-white uppercase mb-1">INVOICE TRANSACTION CONTROLLER</h4>
            <p className="text-xs text-muted">Outstanding balance of <span className="font-bold text-white">{invoice.amount_due.toLocaleString()} THB</span> requires customer settlement.</p>
          </div>

          <button
            onClick={() => {
              setPayAmount(invoice.amount_due);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded bg-brand-red px-4 py-2 text-xs font-bold text-white hover:bg-brand-red-hover"
          >
            <CreditCard size={12} /> Record Customer Payment
          </button>
        </div>
      )}

      {/* Record Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white uppercase tracking-tight">
              RECORD PAYMENT
            </h2>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Outstanding Due Balance</label>
                <p className="brand-input bg-background/50 border-dashed text-warning font-mono font-bold">
                  {invoice.amount_due.toLocaleString()} THB
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Payment Amount (THB)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="brand-input w-full font-mono"
                  value={payAmount}
                  max={invoice.amount_due}
                  onChange={(e) => setPayAmount(Number.parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Payment Method</label>
                <select
                  required
                  className="brand-input w-full"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as "cash" | "credit_card" | "bank_transfer" | "qr_payment")}
                >
                  <option value="bank_transfer">Bank Transfer (QR/Mobile)</option>
                  <option value="qr_payment">PromptPay QR Code</option>
                  <option value="cash">Cash Settlement</option>
                  <option value="credit_card">Credit Card Terminal</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Transaction Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. TXN-KPLUS-9823412"
                  className="brand-input w-full font-mono text-xs"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin" size={14} /> : null}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
