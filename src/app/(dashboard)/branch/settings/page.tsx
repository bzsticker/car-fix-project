"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Save, ShieldAlert, Sparkles, Store } from "lucide-react";

type BranchSettings = {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
};

export default function BranchSettingsPage() {
  const [settings, setSettings] = useState<BranchSettings | null>(null);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadBranchSettings = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/settings/branch");
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error?.message ?? "Failed to load branch configuration");
      }

      const branchData: BranchSettings = payload.data;
      setSettings(branchData);
      setPhone(branchData.phone);
      setAddress(branchData.address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to establish branch credentials connection");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadBranchSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadBranchSettings]);

  const handleSettingsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      phone,
      address,
    };

    try {
      const res = await fetch("/api/v1/settings/branch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const payloadData = await res.json();

      if (!res.ok) {
        throw new Error(payloadData.error?.message ?? "Failed to update branch profile");
      }

      setSuccess("Branch settings profile updated successfully!");
      setSettings(payloadData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record modifications");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="animate-spin text-brand-red" size={32} />
        <span className="text-muted text-sm">Synchronizing branch configurations...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header Panel */}
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
          BRANCH <span className="text-brand-red">SETTINGS</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage shop contact profiles, location address, and parameters for {settings?.name}
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white flex items-center gap-3">
          <ShieldAlert className="text-brand-red" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="rounded-md border border-success/30 bg-success/10 p-4 text-sm text-white flex items-center gap-3">
          <Sparkles className="text-success" />
          <span>{success}</span>
        </div>
      ) : null}

      {/* Main Settings Form */}
      {settings && (
        <div className="glass-card p-8 bg-[#111111]/90">
          <form onSubmit={handleSettingsSubmit} className="space-y-6">
            
            {/* Identity Info Read Only */}
            <div className="flex items-center gap-4 border-b border-border/60 pb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded bg-brand-red/10 border border-brand-red/20 text-brand-red">
                <Store size={22} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-red">Branch Identity</p>
                <h3 className="text-lg font-bold text-white mt-0.5">{settings.name}</h3>
                <p className="text-xxs text-muted mt-0.5">UID: {settings.id}</p>
              </div>
            </div>

            {/* Phone contact input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Branch Phone Number</label>
              <input
                type="text"
                required
                className="brand-input w-full"
                placeholder="e.g. +6680-000-0001"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xxs text-muted/60">Primary phone line that will appear on print receipts and tax invoices.</p>
            </div>

            {/* Address textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Shop Physical Address</label>
              <textarea
                required
                className="brand-input w-full h-32 resize-none"
                placeholder="e.g. 123 Srinakarin Rd, Nong Bon, Prawet, Bangkok 10250"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <p className="text-xxs text-muted/60">Registered location mapping coordinates and address details used for GPS shift clock registers.</p>
            </div>

            {/* Submit Action */}
            <div className="flex justify-end border-t border-border/40 pt-6 mt-6">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded bg-brand-red px-5 py-3 text-xs font-extrabold uppercase tracking-widest text-white hover:bg-brand-red-hover disabled:opacity-50 transition-all shadow-lg shadow-brand-red/20"
              >
                {submitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Save Branch Changes
              </button>
            </div>

          </form>
        </div>
      )}
    </div>
  );
}
