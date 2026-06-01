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

export default function OwnerInvoiceDetailPage() {
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
          onClick={() => router.push("/owner/invoices")}
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
          onClick={() => router.push("/owner/invoices")}
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

          {!isReadOnly && invoice.status !== "paid" && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded bg-brand-red px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-brand-red-hover"
            >
              <CreditCard size={14} /> Record Payment
            </button>
          )}
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

        {/* Customer & Vehicle Coordinates */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-xs text-muted print:text-black/80">
          <div>
            <p className="font-bold text-white print:text-black mb-1">CLIENT MEMBER</p>
            <p className="font-semibold text-white print:text-black">{invoice.customer?.full_name ?? "Walk-In Customer"}</p>
            <p>Phone: {invoice.customer?.phone ?? "--"}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-bold text-white print:text-black mb-1">VEHICLE DETAILS</p>
            {invoice.job?.car ? (
              <>
                <p className="font-semibold text-white print:text-black">
                  {invoice.job.car.make} {invoice.job.car.model}
                </p>
                <p>License Plate: {invoice.job.car.license_plate}</p>
              </>
            ) : (
              <p>N/A</p>
            )}
          </div>
        </div>

        {/* Invoice Itemized Table */}
        <div className="border border-border/80 rounded overflow-hidden print:border-black/20">
          <table className="w-full text-left text-xs text-muted print:text-black/85">
            <thead className="bg-white/5 text-white font-bold uppercase print:bg-black/5 print:text-black">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card/10 print:bg-transparent print:divide-black/10">
              
              {/* Services items */}
              {invoice.job?.services.map((svc) => (
                <tr key={svc.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white print:text-black">{svc.name}</p>
                    <p className="text-[10px] text-muted print:text-black/70">Labor Charge / Tuning Specialist</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-white print:text-black">
                    {svc.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {/* Parts items */}
              {invoice.job?.parts.map((prt, index) => (
                <tr key={prt.id ?? index}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white print:text-black">Parts Installation SKU</p>
                    <p className="text-[10px] text-muted print:text-black/70">Qty {prt.quantity} x {prt.unit_price.toLocaleString()} THB</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-white print:text-black">
                    {prt.total_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {(!invoice.job || (invoice.job.services.length === 0 && invoice.job.parts.length === 0)) && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-muted">
                    No billable services or parts recorded.
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

        {/* Calculations Ledger */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-6 pt-4">
          
          {/* Payment History */}
          <div className="flex-1 space-y-2">
            <h3 className="text-xs font-bold text-white print:text-black uppercase">PAYMENT SETTLEMENT HISTORY</h3>
            <div className="space-y-2">
              {invoice.payments.length > 0 ? (
                invoice.payments.map((pmt) => (
                  <div key={pmt.id} className="bg-background/40 border border-border/50 rounded p-3 text-xxs text-muted print:border-black/10 print:text-black/80">
                    <div className="flex justify-between font-semibold text-white print:text-black">
                      <span>{pmt.payment_method.replace(/_/g, " ").toUpperCase()}</span>
                      <span>{pmt.amount.toLocaleString()} THB</span>
                    </div>
                    <p className="mt-1">Date: {new Date(pmt.payment_date).toLocaleString()}</p>
                    {pmt.transaction_reference && (
                      <p className="font-mono text-[9px] mt-0.5">Ref: {pmt.transaction_reference}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted italic">No payment transactions registered.</p>
              )}
            </div>
          </div>

          {/* Calculations Ledger summary */}
          <div className="w-full sm:w-64 space-y-2.5 text-xs text-muted print:text-black/85">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold text-white print:text-black">
                {(invoice.total_amount - invoice.tax_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} THB
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tax (VAT 7%):</span>
              <span className="font-semibold text-white print:text-black">
                {invoice.tax_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB
              </span>
            </div>
            <div className="flex justify-between">
              <span>Discounts:</span>
              <span className="font-semibold text-white print:text-black text-brand-red">
                -{invoice.discount_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB
              </span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-2 print:border-black/15">
              <span className="font-bold text-white print:text-black">Total:</span>
              <span className="font-extrabold text-white print:text-black text-sm">
                {invoice.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB
              </span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-2 print:border-black/15 text-white print:text-black font-semibold">
              <span>Amount Due:</span>
              <span className={`font-bold ${invoice.amount_due > 0 ? "text-brand-red" : "text-success"}`}>
                {invoice.amount_due.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* Record Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white uppercase">Record Cash Payment</h2>
            
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Amount Due Remaining</label>
                <div className="brand-input bg-white/5 border border-border/60 text-white font-bold font-mono">
                  {invoice.amount_due.toLocaleString()} THB
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Payment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={invoice.amount_due}
                  className="brand-input w-full font-bold text-brand-red font-mono"
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Settlement Method</label>
                <select
                  className="brand-input w-full"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as "cash" | "credit_card" | "bank_transfer" | "qr_payment")}
                >
                  <option value="bank_transfer">Bank Transfer (SCB / KBank)</option>
                  <option value="qr_payment">PromptPay QR Code Scan</option>
                  <option value="cash">Cash / Banknote</option>
                  <option value="credit_card">Visa / Mastercard / JCB Card</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Transaction Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SCB-94819..."
                  className="brand-input w-full font-mono text-xs"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded border border-border bg-card px-4 py-2 text-xs font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded bg-brand-red px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
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
