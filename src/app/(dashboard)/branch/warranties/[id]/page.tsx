"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Camera, Clock, Loader2, ShieldAlert, Sliders } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  full_name: string;
  phone: string;
};

type CarType = {
  id: string;
  license_plate: string;
  make: string;
  model: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
};

type Job = {
  id: string;
  total_amount: number;
};

type Claim = {
  id: string;
  warranty_id: string;
  claim_date: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "completed";
  image_url: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  resolver: {
    full_name: string;
  } | null;
};

type Warranty = {
  id: string;
  warranty_code: string;
  customer_id: string;
  car_id: string;
  product_id: string;
  job_id: string | null;
  start_date: string;
  end_date: string;
  status: "active" | "expired" | "void";
  customer: Customer | null;
  car: CarType | null;
  product: Product | null;
  job: Job | null;
  claims: Claim[];
};

type ProfileType = {
  role: string;
  branch_id: string | null;
};

export default function WarrantyDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // File Claim Modal State
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimDesc, setClaimDesc] = useState("");
  const [claimImg, setClaimImg] = useState("");

  // Resolve Claim Modal State
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [targetClaim, setTargetClaim] = useState<Claim | null>(null);
  const [resolveStatus, setResolveStatus] = useState<"approved" | "rejected" | "completed">("approved");
  const [resolveNotes, setResolveNotes] = useState("");

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

      // 2. Fetch Warranty Details via API
      const response = await fetch(`/api/v1/warranties/${id}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Warranty sheet not found");
      }
      setWarranty(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database warranty");
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

  // File Defect Claim Submit Handler
  const handleFileClaim = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/warranties/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warranty_id: id,
          description: claimDesc,
          image_url: claimImg || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to file warranty claim");
      }

      setSuccess("Warranty claim filed successfully! Status is pending review.");
      setClaimModalOpen(false);
      setClaimDesc("");
      setClaimImg("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  };

  // Resolve Defect Claim Submit Handler
  const handleResolveClaim = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!targetClaim) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/warranties/claims/${targetClaim.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: resolveStatus,
          resolution_notes: resolveNotes,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to update claim workflow");
      }

      setSuccess(`Claim successfully transitioned to "${resolveStatus}"!`);
      setResolveModalOpen(false);
      setResolveNotes("");
      setTargetClaim(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve claim");
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = profile?.role === "technician";
  const start = warranty ? new Date(warranty.start_date).getTime() : 0;
  const end = warranty ? new Date(warranty.end_date).getTime() : 0;
  const isExpired = now > end || warranty?.status === "expired";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="animate-spin text-brand-red" size={32} />
        <span className="text-muted text-sm font-semibold">Loading warranty coverage and claims history...</span>
      </div>
    );
  }

  if (error || !warranty) {
    return (
      <div className="space-y-4 py-8 max-w-4xl mx-auto">
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white flex items-center gap-3">
          <ShieldAlert className="text-brand-red" />
          <span>{error ?? "Requested warranty registry does not exist."}</span>
        </div>
        <button
          onClick={() => router.push("/branch/warranties")}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
        >
          <ArrowLeft size={14} /> Back to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation Headers */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/branch/warranties")}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
        >
          <ArrowLeft size={14} /> Back to Registry
        </button>
      </div>

      {/* Notifications */}
      {success && (
        <div className="rounded-md border border-success/30 bg-success/10 p-4 text-sm text-white">
          {success}
        </div>
      )}

      {/* Warranty Specification Card */}
      <div className="glass-card p-6 bg-[#111111] space-y-6">
        <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-border bg-background text-brand-red">
              WARRANTY SHEET
            </span>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white mt-1">
              {warranty.product?.name}
            </h1>
            <p className="text-xs text-muted font-mono">
              WARRANTY CODE: <span className="text-white font-semibold">{warranty.warranty_code}</span> 
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className={`text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded border ${
              warranty.status === "active" && !isExpired
                ? "bg-success/15 border-success/30 text-success animate-pulse"
                : "bg-brand-red/15 border-brand-red/30 text-brand-red"
            }`}>
              {isExpired ? "EXPIRED" : warranty.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 text-xs text-muted">
          <div className="space-y-1 bg-background/30 p-4 rounded border border-border/40">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted">CUSTOMER PARTICULARS</p>
            <p className="font-semibold text-white text-sm mt-1">{warranty.customer?.full_name}</p>
            <p className="text-[10px]">Phone: {warranty.customer?.phone}</p>
          </div>

          <div className="space-y-1 bg-background/30 p-4 rounded border border-border/40">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted">VEHICLE PARTICULARS</p>
            <p className="font-semibold text-white text-sm mt-1 uppercase">{warranty.car?.license_plate}</p>
            <p className="text-[10px]">{warranty.car?.make} {warranty.car?.model}</p>
          </div>

          <div className="space-y-1 bg-background/30 p-4 rounded border border-border/40">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted">LINKED MODIFICATION DETAILS</p>
            <p className="font-semibold text-white text-sm mt-1">
              {warranty.job ? `Job Ticket #${warranty.job.id.slice(0, 8).toUpperCase()}` : "Retail Over-the-counter POS"}
            </p>
            <p className="text-[10px]">{warranty.job ? `Job Amount: ${warranty.job.total_amount.toLocaleString()} THB` : "--"}</p>
          </div>
        </div>

        {/* Coverage Countdown progress */}
        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex justify-between text-xs text-muted font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1"><Clock size={12} /> Coverage Duration Countdown</span>
            <span>{isExpired ? "0" : Math.max(0, Math.min(100, ((end - now) / (end - start)) * 100)).toFixed(0)}% remaining</span>
          </div>
          <div className="h-2 w-full bg-background/50 rounded overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${isExpired ? "bg-brand-red" : "bg-success"}`}
              style={{ width: `${isExpired ? 100 : Math.max(0, Math.min(100, ((end - now) / (end - start)) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted font-semibold">
            <span className="flex items-center gap-1"><Calendar size={11} /> Registered: {new Date(warranty.start_date).toLocaleDateString()}</span>
            <span>Expiration Date: {new Date(warranty.end_date).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Control Actions panel */}
      {warranty.status === "active" && !isExpired && (
        <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-bold text-white uppercase mb-1">WARRANTY CONTROLS & DEFECTS REGISTRY</h4>
            <p className="text-xs text-muted">A defect claim can be filed under this active modify coverage for material anomalies.</p>
          </div>

          <button
            onClick={() => setClaimModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded bg-brand-red px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-red-hover transition-all"
          >
            <Camera size={14} /> File Defect Claim
          </button>
        </div>
      )}

      {/* Defect Claims History Table */}
      <div className="glass-card p-6 bg-[#111111] space-y-4">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider text-muted">DEFECT CLAIMS WORKFLOW HISTORIES</h2>
        
        <div className="border border-border/80 rounded overflow-hidden">
          <table className="w-full text-left text-xs text-muted">
            <thead className="bg-background text-[10px] font-bold uppercase tracking-wider text-white border-b border-border/80">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Defect Description</th>
                <th className="px-4 py-3 text-center">Defect Image</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Resolved By / Notes</th>
                {!isReadOnly && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {warranty.claims.length > 0 ? (
                warranty.claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-white/[0.01]">
                    <td className="px-4 py-3.5 whitespace-nowrap">{new Date(claim.claim_date).toLocaleString()}</td>
                    <td className="px-4 py-3.5 font-medium text-white max-w-xs leading-normal">{claim.description}</td>
                    <td className="px-4 py-3.5 text-center">
                      {claim.image_url ? (
                        <a
                          href={claim.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold text-brand-red hover:underline"
                        >
                          [View defect photo]
                        </a>
                      ) : (
                        <span className="text-muted italic text-[10px]">No photo attached</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                        claim.status === "completed"
                          ? "bg-success/15 border-success/30 text-success"
                          : claim.status === "approved"
                          ? "bg-success/10 border-success/20 text-success"
                          : claim.status === "rejected"
                          ? "bg-brand-red/15 border-brand-red/30 text-brand-red"
                          : "bg-warning/15 border-warning/30 text-warning"
                      }`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 leading-normal max-w-xs">
                      {claim.resolved_by ? (
                        <div>
                          <p className="font-semibold text-white">{claim.resolver?.full_name}</p>
                          <p className="text-[10px] italic">{claim.resolution_notes}</p>
                        </div>
                      ) : (
                        <span className="text-muted italic text-[10px]">Pending review</span>
                      )}
                    </td>
                    {!isReadOnly && (
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {claim.status !== "completed" ? (
                          <button
                            onClick={() => {
                              setTargetClaim(claim);
                              setResolveNotes("");
                              setResolveModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-white/5 transition-all"
                          >
                            <Sliders size={10} /> Resolve
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted italic">Finalized</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isReadOnly ? 5 : 6} className="px-4 py-8 text-center text-muted italic">
                    No defect claims logged under this warranty sheet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* File Defect Claim Modal */}
      {claimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white uppercase tracking-tight">
              File Defect Claim
            </h2>

            <form onSubmit={handleFileClaim} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Defect Description</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe the defect or anomalies in detail... (Min 5 characters)"
                  className="brand-input w-full text-xs"
                  value={claimDesc}
                  onChange={(e) => setClaimDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Defect Photo URL (Optional)</label>
                <input
                  type="url"
                  placeholder="e.g. https://supabase.co/storage/defects/civic_edge.jpg"
                  className="brand-input w-full font-mono text-xs"
                  value={claimImg}
                  onChange={(e) => setClaimImg(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !claimDesc}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Claim Modal (Owner/Admin Only) */}
      {resolveModalOpen && targetClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white uppercase tracking-tight">
              Resolve Warranty Claim
            </h2>
            <p className="text-xs text-muted mb-4 leading-relaxed font-semibold uppercase">Defect: <span className="text-white">{targetClaim.description}</span></p>

            <form onSubmit={handleResolveClaim} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Workflow Decision Status</label>
                <select
                  required
                  className="brand-input w-full"
                  value={resolveStatus}
                  onChange={(e) => setResolveStatus(e.target.value as "approved" | "rejected" | "completed")}
                >
                  <option value="approved">Approved (Issue Verified)</option>
                  <option value="rejected">Rejected (Not Covered)</option>
                  <option value="completed">Completed (Work finalized & sealed)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Resolution Audit Notes</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Details of inspection and repair actions... (Min 5 chars)"
                  className="brand-input w-full text-xs"
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !resolveNotes}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Confirm Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
