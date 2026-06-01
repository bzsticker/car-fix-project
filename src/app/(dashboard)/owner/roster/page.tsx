import { Clock, Users, Calendar, MapPin, Camera, FileText, Users2 } from "lucide-react";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/server";

export const revalidate = 0;

type ProfileRow = {
  full_name: string;
  role: string;
  branch_id: string | null;
};

type AttendanceLog = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  status: string;
  latitude: number | string | null;
  longitude: number | string | null;
  selfie_url: string | null;
  notes: string | null;
  profile: ProfileRow | ProfileRow[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export default async function OwnerRosterPage() {
  const supabase = createAdminClient();

  const [
    { data: logs, error: logsError },
    { data: branches }
  ] = await Promise.all([
    supabase
      .from("attendance_logs")
      .select("id, clock_in, clock_out, status, latitude, longitude, selfie_url, notes, profile:profiles(full_name, role, branch_id)")
      .order("clock_in", { ascending: false }),
    supabase.from("branches").select("id, name"),
  ]);

  if (logsError) {
    return (
      <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-6 text-white">
        <h2 className="text-lg font-bold">Error loading roster logs</h2>
        <p className="text-sm text-muted">Please refresh the page or contact system support.</p>
      </div>
    );
  }

  const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const normalizedLogs = ((logs ?? []) as AttendanceLog[]).map((log) => {
    const profileVal = firstRelation(log.profile);
    const branchName = profileVal?.branch_id ? branchMap.get(profileVal.branch_id) : "Global / Owner";
    return {
      ...log,
      profile: profileVal,
      branchName,
    };
  });

  const onDutyCount = normalizedLogs.filter((log) => log.clock_out === null).length;
  const lateCount = normalizedLogs.filter((log) => log.status === "late").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            STAFF <span className="text-brand-red">ROSTER LOGS</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Global attendance, active duty shifts, and terminal clocks</p>
        </div>
        <Link
          href="/owner"
          className="self-start rounded-md border border-border bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/10"
        >
          &larr; Back to Overview
        </Link>
      </div>

      {/* Roster KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>ON DUTY STAFF</span>
            <Users className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">{onDutyCount}</p>
          <p className="mt-1 text-xs text-muted">Technicians and admins currently clocked-in</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>LATE ARRIVALS</span>
            <Clock className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">{lateCount}</p>
          <p className="mt-1 text-xs text-muted">Shift clock-ins marked late today</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>TOTAL SIGN IN LOGS</span>
            <Calendar className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">{normalizedLogs.length}</p>
          <p className="mt-1 text-xs text-muted">Total historical attendance logs captured</p>
        </div>
      </div>

      {/* Roster Logs Table */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-bold text-white">CHRONOLOGICAL SHIFT TIMESHEET</h2>
        </div>

        {normalizedLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users2 className="mb-4 text-muted" size={48} />
            <h3 className="text-lg font-bold text-white">No Roster Logs Found</h3>
            <p className="mt-1 text-sm text-muted">Staff shift check-ins will display here once captured.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-muted">
              <thead className="bg-white/5 text-xs font-semibold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Branch</th>
                  <th className="px-6 py-4">Clock In / Out</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">GPS Coordinate</th>
                  <th className="px-6 py-4 text-right">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {normalizedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/2 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-semibold text-white">
                        {log.profile?.full_name ?? "Unknown Staff"}
                      </div>
                      <div className="text-xs uppercase text-muted tracking-wider mt-0.5">
                        {log.profile?.role ?? "Staff"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-white">
                      {log.branchName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-white">
                        In: {new Date(log.clock_in).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        Out: {log.clock_out ? new Date(log.clock_out).toLocaleString() : "Active Shift"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                          log.clock_out === null
                            ? "border border-success/20 bg-success/10 text-success"
                            : log.status === "late"
                            ? "border border-brand-red/20 bg-brand-red/10 text-brand-red"
                            : "border border-border bg-white/5 text-muted"
                        }`}
                      >
                        {log.clock_out === null ? "On Duty" : log.status === "late" ? "Late" : "Completed"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs">
                      {log.latitude && log.longitude ? (
                        <div className="flex items-center gap-1.5 text-white">
                          <MapPin size={12} className="text-brand-red" />
                          <span>
                            {Number(log.latitude).toFixed(4)}, {Number(log.longitude).toFixed(4)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">No GPS</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {log.selfie_url ? (
                          <a
                            href={log.selfie_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs font-medium text-white transition hover:bg-white/10"
                            title="View Clock Selfie"
                          >
                            <Camera size={12} className="text-brand-red" />
                            <span>Selfie</span>
                          </a>
                        ) : null}
                        {log.notes ? (
                          <div className="group relative">
                            <button
                              className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs font-medium text-white transition hover:bg-white/10"
                              title={log.notes}
                            >
                              <FileText size={12} className="text-brand-red" />
                              <span>Notes</span>
                            </button>
                            <div className="absolute right-0 bottom-full z-10 mb-2 hidden w-48 rounded bg-background border border-border p-2 text-left text-xs shadow-xl group-hover:block">
                              {log.notes}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
