"use client";

import React, { useEffect, useState } from "react";
import { Camera, Calendar, Clock, Loader2, MapPin, Percent, ShieldAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type AttendanceLog = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  status: "on_time" | "late" | "absent";
  latitude: number | null;
  longitude: number | null;
  selfie_url: string | null;
  notes: string | null;
  employee: {
    full_name: string;
    email: string;
  } | null;
};

type SummaryStats = {
  total_shifts: number;
  on_time_shifts: number;
  late_shifts: number;
  active_shifts: number;
  late_rate: number;
  total_hours_worked: number;
  avg_hours_worked: number;
};

export default function AttendanceDashboardPage() {
  const supabase = createClient();

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [branchName, setBranchName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default MTD
    return d.toISOString().split("T")[0] ?? "";
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0] ?? "");

  // Selfie Modal State
  const [selectedSelfie, setSelectedSelfie] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState("");

  const loadAttendanceData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Resolve Branch Name
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No active credentials session found");

      const { data: profile } = await supabase
        .from("profiles")
        .select("branch_id")
        .eq("id", user.id)
        .single();

      if (profile?.branch_id) {
        const { data: branch } = await supabase
          .from("branches")
          .select("name")
          .eq("id", profile.branch_id)
          .single();
        if (branch) setBranchName(branch.name);
      }

      // 2. Fetch Attendance Report API
      // Add timezone offset to cover the whole selected day
      const startIso = new Date(startDate).toISOString();
      const endIso = new Date(`${endDate}T23:59:59.999Z`).toISOString();

      const res = await fetch(
        `/api/v1/reports/attendance?start_date=${startIso}&end_date=${endIso}`
      );
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error?.message ?? "Failed to compile shift logs");
      }

      setLogs(payload.data.logs ?? []);
      setSummary(payload.data.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database registries");
    } finally {
      setLoading(false);
    }
  }, [supabase, startDate, endDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAttendanceData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAttendanceData]);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            SHIFT <span className="text-brand-red">CLOCK REGISTRY</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Global management of employee clock-in hours, GPS locks, and selfies for {branchName || "Branch HQ"}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white flex items-center gap-3">
          <ShieldAlert className="text-brand-red" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* KPI Cards Matrix */}
      {summary && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-card p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">TOTAL SHIFTS</p>
              <h3 className="font-display text-2xl font-extrabold text-white mt-1">
                {summary.total_shifts} <span className="text-xs font-normal text-muted">Clockings</span>
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded bg-white/5 border border-border text-white">
              <Calendar size={20} />
            </div>
          </div>

          <div className="glass-card p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">ACTIVE ON DUTY</p>
              <h3 className="font-display text-2xl font-extrabold text-success mt-1">
                {summary.active_shifts} <span className="text-xs font-normal text-muted">Staff</span>
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded bg-success/10 border border-success/20 text-success">
              <Clock size={20} />
            </div>
          </div>

          <div className="glass-card p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">LATE WORK RATE</p>
              <h3 className="font-display text-2xl font-extrabold text-brand-red mt-1">
                {summary.late_rate}% <span className="text-xs font-normal text-muted">Delay</span>
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded bg-brand-red/10 border border-brand-red/20 text-brand-red">
              <Percent size={20} />
            </div>
          </div>

          <div className="glass-card p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">AVG SHIFT TIME</p>
              <h3 className="font-display text-2xl font-extrabold text-white mt-1">
                {summary.avg_hours_worked} <span className="text-xs font-normal text-muted">Hours</span>
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded bg-white/5 border border-border text-white">
              <Clock size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Date Filters Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center glass-card p-4">
        <div className="flex-1 text-sm text-muted flex items-center gap-2">
          <Clock size={16} className="text-brand-red" />
          <span>Define audit timeframe limits for the cashier shift attendance registry.</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted uppercase">From</span>
            <input
              type="date"
              className="brand-input text-xs"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted uppercase">To</span>
            <input
              type="date"
              className="brand-input text-xs"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Shift Table Ledger */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-border bg-background/30 px-6 py-4 flex justify-between items-center">
          <h2 className="font-display text-sm font-bold text-white uppercase tracking-wider">Employee Shift Registry Logs</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-red mr-2" />
            <span className="text-muted text-sm">Compiling staff attendance sheets...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background/40 border-b border-border">
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Employee</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Clock In Time</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Clock Out Time</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Status</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">GPS Coordinates Match</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Verification Photo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card/10">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-white/5">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-white">{log.employee?.full_name ?? "Workshop Employee"}</p>
                        <p className="text-xs text-muted mt-0.5">{log.employee?.email ?? "--"}</p>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-white">
                        {new Date(log.clock_in).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-white">
                        {log.clock_out ? new Date(log.clock_out).toLocaleString() : "--:--"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xxs font-extrabold uppercase border ${
                          log.status === "on_time"
                            ? "bg-success/15 border-success/35 text-success"
                            : "bg-warning/15 border-warning/35 text-warning"
                        }`}>
                          {log.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-muted">
                        {log.latitude && log.longitude ? (
                          <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-brand-red" />
                            <span>
                              Mapped ({log.latitude.toFixed(4)}, {log.longitude.toFixed(4)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted/60 italic">No GPS coordinates</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs">
                        {log.selfie_url ? (
                          <button
                            onClick={() => {
                              setSelectedSelfie(log.selfie_url);
                              setSelectedEmployeeName(log.employee?.full_name ?? "Employee");
                            }}
                            className="inline-flex items-center gap-1 text-brand-red hover:underline font-semibold"
                          >
                            <Camera size={14} /> View Selfie
                          </button>
                        ) : (
                          <span className="text-muted/50 italic">No Photo uploaded</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-muted">
                      No shift records registered during this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selfie Preview Modal */}
      {selectedSelfie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm bg-card p-6 relative border-t-4 border-t-brand-red">
            <h2 className="mb-3 font-display text-lg font-bold text-white uppercase tracking-wider text-center">
              Selfie Verification Photo
            </h2>
            <p className="text-center text-xs text-muted mb-4">
              Registered by <span className="font-semibold text-white">{selectedEmployeeName}</span>
            </p>

            <div className="aspect-square w-full rounded overflow-hidden border border-border bg-black relative flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedSelfie}
                alt="Employee Clock selfie"
                className="object-cover w-full h-full"
              />
            </div>

            <button
              onClick={() => setSelectedSelfie(null)}
              className="mt-6 w-full rounded border border-border bg-card py-2.5 text-xs font-semibold text-white hover:bg-white/5 uppercase tracking-wider"
            >
              [ Close Verification Window ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
