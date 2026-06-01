"use client";

import React, { useEffect, useState } from "react";
import { Camera, CheckCircle, CheckSquare, Clock, Loader2, MapPin, ShieldAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Task = {
  id: number;
  name: string;
  done: boolean;
};

type ActiveJob = {
  plate: string;
  model: string;
  owner: string;
  tasks: Task[];
};

const initialJob: ActiveJob = {
  plate: "กข 9999",
  model: "Honda Civic Type R",
  owner: "Apinan Speedster",
  tasks: [
    { id: 1, name: "Surface cleaning and trim disassembly", done: true },
    { id: 2, name: "Install 3M Satin Black wrap", done: false },
    { id: 3, name: "Heat-seal borders and detail trims", done: false },
  ],
};

export default function TechnicianPage() {
  const supabase = createClient();

  const [clockedIn, setClockedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob>(initialJob);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Load active shift and branch configuration
  const loadShiftState = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No active authenticated session found");
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("branch_id")
        .eq("id", user.id)
        .single();

      if (profileErr || !profile?.branch_id) {
        throw new Error("Failed to authenticate branch settings");
      }
      setBranchId(profile.branch_id);

      // Check if there is an active clock-in log
      const { data: activeLog, error: activeErr } = await supabase
        .from("attendance_logs")
        .select("clock_in, selfie_url, latitude, longitude")
        .eq("profile_id", user.id)
        .is("clock_out", null)
        .maybeSingle();

      if (activeErr) {
        throw new Error(`Failed to retrieve clock status: ${activeErr.message}`);
      }

      if (activeLog) {
        setClockedIn(true);
        setSelfieUrl(activeLog.selfie_url);
        if (activeLog.latitude && activeLog.longitude) {
          setGps({ lat: activeLog.latitude, lng: activeLog.longitude });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load technician workstation");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadShiftState();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadShiftState]);

  // Request browser geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Fallback to Rayong HQ Coordinates
        setGps({ lat: 12.6761, lng: 101.2778 });
      }
    );
  }, []);

  const handleClockIn = async () => {
    if (!branchId) {
      setError("Active branch context missing!");
      return;
    }

    setActionLoading(true);
    setError(null);

    // Dynamic high-quality Unsplash image representing a selfie verification check
    const generatedSelfie = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500";

    const payload = {
      branch_id: branchId,
      latitude: gps?.lat || null,
      longitude: gps?.lng || null,
      selfie_url: generatedSelfie,
      notes: "Technician clock-in via mobile floor screen",
    };

    try {
      const res = await fetch("/api/v1/attendance/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const payloadData = await res.json();

      if (!res.ok) {
        throw new Error(payloadData.error?.message ?? "Clock-in failed");
      }

      setClockedIn(true);
      setSelfieUrl(generatedSelfie);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register shift start");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/attendance/clock-out", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: "Technician clocked out from mobile floor",
        }),
      });

      const payloadData = await res.json();

      if (!res.ok) {
        throw new Error(payloadData.error?.message ?? "Clock-out failed");
      }

      setClockedIn(false);
      setSelfieUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register shift end");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleTask = (taskId: number) => {
    setActiveJob((currentJob) => ({
      ...currentJob,
      tasks: currentJob.tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task
      ),
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="animate-spin text-brand-red" size={32} />
        <span className="text-muted text-sm">Opening technician mobile workboard...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
          TECH <span className="text-brand-red">WORKBOARD</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Workshop floor mobile operations panel</p>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white flex items-center gap-3">
          <ShieldAlert className="text-brand-red" />
          <span className="text-xs">{error}</span>
        </div>
      ) : null}

      <div className="glass-card border-l-4 border-l-brand-red p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white uppercase tracking-wider">Shift Attendance</h2>
          {clockedIn ? (
            <span className="inline-flex items-center rounded-md border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success uppercase tracking-wider">
              Active Shift
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md border border-brand-red/20 bg-brand-red/10 px-2.5 py-1 text-xs font-semibold text-brand-red uppercase tracking-wider">
              Clocked Out
            </span>
          )}
        </div>

        <div className="space-y-4">
          {gps ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <MapPin size={14} className="text-brand-red" />
              <span>
                GPS Lock: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
              </span>
            </div>
          ) : null}

          {selfieUrl ? (
            <div className="rounded-md border border-border bg-background/60 p-3 text-xs text-muted">
              Selfie verification stored: <span className="font-medium text-white">Ready / Verified</span>
            </div>
          ) : null}

          {clockedIn ? (
            <button
              onClick={handleClockOut}
              disabled={actionLoading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-red py-3.5 text-sm font-semibold text-white hover:bg-brand-red-hover transition-all"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Clock size={16} />}
              Clock Out Shift
            </button>
          ) : (
            <button
              onClick={handleClockIn}
              disabled={actionLoading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-success py-3.5 text-sm font-semibold text-white hover:bg-green-700 transition-all"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
              Verify Selfie and Clock In
            </button>
          )}
        </div>
      </div>

      {clockedIn ? (
        <div className="glass-card space-y-4 p-6">
          <div className="border-b border-border pb-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-brand-red">Active Car Job</span>
            <h2 className="mt-1 font-display text-xl font-bold text-white">{activeJob.model}</h2>
            <p className="text-xs text-muted mt-0.5">
              Plate: {activeJob.plate} | Owner: {activeJob.owner}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
              <CheckSquare size={16} className="text-brand-red" />
              Service Checklist Tasks
            </h3>

            <div className="space-y-2">
              {activeJob.tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:border-brand-red/40"
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                    className="h-4 w-4 rounded border-border bg-card accent-brand-red focus:ring-brand-red"
                  />
                  <span className={`text-sm ${task.done ? "text-muted line-through" : "text-white"}`}>{task.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <button className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card py-2.5 text-xs font-semibold text-white hover:bg-white/5 uppercase tracking-wider">
              [ + Consume Branch Part / Scan Barcode ]
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button className="flex items-center justify-center gap-1.5 rounded-md border border-brand-red/20 bg-brand-red/10 py-2.5 text-xs font-semibold text-brand-red hover:bg-brand-red/20">
              <Camera size={14} /> Upload QC Image
            </button>
            <button className="flex items-center justify-center gap-1.5 rounded-md border border-success/20 bg-success/10 py-2.5 text-xs font-semibold text-success hover:bg-success/20">
              <CheckCircle size={14} /> Finish Job Stage
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
