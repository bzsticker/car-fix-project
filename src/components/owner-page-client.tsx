"use client";

import React from "react";
import { AlertTriangle, Clipboard, DollarSign, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type PaymentRow = {
  amount: number | string;
};

type AttendanceRow = {
  id: string;
  clock_in: string;
  profile: { full_name: string } | null;
};

interface OwnerPageClientProps {
  branchCount: number | null;
  jobsCount: number | null;
  payments: PaymentRow[] | null;
  activeAttendance: AttendanceRow[];
}

export default function OwnerPageClient({
  branchCount,
  jobsCount,
  payments,
  activeAttendance,
}: OwnerPageClientProps) {
  const { t } = useLanguage();

  const totalRevenue =
    payments?.reduce((accumulator, payment) => accumulator + Number(payment.amount), 0) ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-white animate-fade-in">
          {t("OWNER HQ BOARD").split(" ")[0]}{" "}
          <span className="text-brand-red">
            {t("OWNER HQ BOARD").split(" ").slice(1).join(" ")}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t("Global operations and multi-branch performance dashboard")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-6 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("Global Revenue (MTD)")}
            </span>
            <DollarSign className="text-brand-red" size={20} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-white">
              {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold rounded bg-success/15 px-1.5 py-0.5 text-success">
              Live
            </span>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-brand-red" style={{ width: "65%" }} />
          </div>
        </div>

        <div className="glass-card p-6 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("Total Active Jobs")}
            </span>
            <Clipboard className="text-brand-red" size={20} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-white">
              {jobsCount ?? 0} {t("Total Active Jobs").toLowerCase().includes("job") ? "Active" : "งาน"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {t("Across 2 active branches").replace("2", String(branchCount ?? 2))}
          </p>
        </div>

        <div className="glass-card p-6 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("Staff Shift Clocks")}
            </span>
            <Users className="text-brand-red" size={20} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-white">
              {activeAttendance.length} {t("Staff Shift Clocks").toLowerCase().includes("staff") ? "Clocked" : "คน"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">{t("Today's active timesheet logs")}</p>
        </div>

        <div className="glass-card p-6 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("Stock Alerts")}
            </span>
            <AlertTriangle className="text-warning" size={20} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-white">
              3 {t("Stock Alerts").toLowerCase().includes("alert") ? "Alerts" : "รายการ"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">{t("Low inventory stock level thresholds")}</p>
        </div>
      </div>

      <div className="glass-card p-8">
        <h2 className="mb-6 font-display text-xl font-bold text-white tracking-tight">
          {t("BRANCH PERFORMANCE OVERVIEW")}
        </h2>
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex justify-between text-sm font-semibold">
              <span className="text-white">Bangkok HQ Branch</span>
              <span className="text-muted">260,000.00 THB MTD</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-brand-red" style={{ width: "67%" }} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-sm font-semibold">
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
          <h2 className="mb-4 font-display text-lg font-bold text-white tracking-tight">
            {t("TODAY'S SHIFT CLOCKS")}
          </h2>
          <div className="divide-y divide-border">
            {activeAttendance.length > 0 ? (
              activeAttendance.map((log) => (
                <div key={log.id} className="flex justify-between py-3 transition-colors hover:bg-white/5 px-2 rounded-md">
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
              <div className="py-6 text-center text-sm text-muted">
                {t("No active attendance logs yet.")}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white tracking-tight">
            {t("STOCK LEVEL WARNINGS")}
          </h2>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between py-3 transition-colors hover:bg-white/5 px-2 rounded-md">
              <div>
                <p className="text-sm font-semibold text-white">Akrapovic FL5 Exhaust</p>
                <p className="text-xs text-muted">SKU: EXH-AKRAP-EVO (Bangkok HQ)</p>
              </div>
              <span className="inline-flex items-center rounded border border-brand-red/20 bg-brand-red/10 px-2 py-0.5 text-xs font-semibold text-brand-red">
                {t("Out of Stock")} (0/1)
              </span>
            </div>
            <div className="flex items-center justify-between py-3 transition-colors hover:bg-white/5 px-2 rounded-md">
              <div>
                <p className="text-sm font-semibold text-white">3M Satin Black Wrap</p>
                <p className="text-xs text-muted">SKU: WRAP-3M-SATINBLK (Pathum Thani)</p>
              </div>
              <span className="inline-flex items-center rounded border border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                {t("Low Stock")} (1/2)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
