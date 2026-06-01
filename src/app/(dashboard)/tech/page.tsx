"use client";

import { useEffect, useState } from "react";
import { Camera, CheckCircle, CheckSquare, Clock, Loader2, MapPin } from "lucide-react";

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
  const [clockedIn, setClockedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>({ lat: 13.6844, lng: 100.6611 });
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob>(initialJob);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setGps({ lat: 13.6844, lng: 100.6611 });
      },
    );
  }, []);

  const handleClockIn = () => {
    setLoading(true);
    window.setTimeout(() => {
      setSelfieUrl("https://supabase.co/storage/v1/object/public/selfies/mock_selfie.jpg");
      setClockedIn(true);
      setLoading(false);
    }, 1500);
  };

  const handleClockOut = () => {
    setLoading(true);
    window.setTimeout(() => {
      setClockedIn(false);
      setSelfieUrl(null);
      setLoading(false);
    }, 1000);
  };

  const toggleTask = (taskId: number) => {
    setActiveJob((currentJob) => ({
      ...currentJob,
      tasks: currentJob.tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    }));
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
          TECH <span className="text-brand-red">WORKBOARD</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Workshop floor mobile operations panel</p>
      </div>

      <div className="glass-card border-l-4 border-l-brand-red p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">SHIFT ATTENDANCE</h2>
          {clockedIn ? (
            <span className="inline-flex items-center rounded-md border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
              Active Shift
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md border border-brand-red/20 bg-brand-red/10 px-2.5 py-1 text-xs font-semibold text-brand-red">
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
              Selfie verification stored: <span className="font-medium text-white">Ready</span>
            </div>
          ) : null}

          {clockedIn ? (
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-red py-3 text-sm font-semibold text-white hover:bg-brand-red-hover"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Clock size={16} />}
              Clock Out Shift
            </button>
          ) : (
            <button
              onClick={handleClockIn}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-success py-3 text-sm font-semibold text-white hover:bg-green-700"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
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
            <p className="text-xs text-muted">
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
            <button className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card py-2.5 text-xs font-semibold text-white hover:bg-white/5">
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
