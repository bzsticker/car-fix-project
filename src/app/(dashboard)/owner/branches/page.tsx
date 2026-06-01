import { Building2, MapPin, Phone, Users, ClipboardList, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

type ProfileRow = {
  id: string;
  role: string;
  branch_id: string | null;
};

type JobRow = {
  id: string;
  branch_id: string;
  status: string;
};

export default async function OwnerBranchesPage() {
  const supabase = await createClient();

  // Fetch branches, profiles (staff), and jobs in parallel for multi-branch performance aggregation
  const [
    { data: branches, error: branchesError },
    { data: profiles },
    { data: jobs }
  ] = await Promise.all([
    supabase.from("branches").select("*").is("deleted_at", null).order("name", { ascending: true }),
    supabase.from("profiles").select("id, role, branch_id").is("deleted_at", null),
    supabase.from("jobs").select("id, branch_id, status").is("deleted_at", null),
  ]);

  if (branchesError) {
    return (
      <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-6 text-white">
        <h2 className="text-lg font-bold">Error loading branches</h2>
        <p className="text-sm text-muted">Please refresh the page or contact system support.</p>
      </div>
    );
  }

  // Handle empty state gracefully
  const hasBranches = branches && branches.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            BRANCH <span className="text-brand-red">HQ PORTAL</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Real-time status, staff density, and operations by location</p>
        </div>
        <Link
          href="/owner"
          className="self-start rounded-md border border-border bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/10"
        >
          &larr; Back to Overview
        </Link>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>TOTAL BRANCHES</span>
            <Building2 className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">
            {branches?.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-muted">Active registered branches in Thailand</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>TOTAL REGISTERED STAFF</span>
            <Users className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">
            {profiles?.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-muted">Active technicians and administrators</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>TOTAL ACTIVE JOBS</span>
            <ClipboardList className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">
            {jobs?.filter((j) => (j as JobRow).status !== "completed" && (j as JobRow).status !== "cancelled").length ?? 0}
          </p>
          <p className="mt-1 text-xs text-muted">Currently in-progress and scheduled tasks</p>
        </div>
      </div>

      {/* Branch Grid */}
      {!hasBranches ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <ShieldAlert className="mb-4 text-muted" size={48} />
          <h3 className="text-lg font-bold text-white">No Branches Found</h3>
          <p className="mt-1 text-sm text-muted">Add a new branch in the database to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {branches.map((branch) => {
            const branchStaff = (profiles ?? []) as ProfileRow[];
            const branchJobs = (jobs ?? []) as JobRow[];

            const adminsCount = branchStaff.filter((p) => p.branch_id === branch.id && p.role === "admin").length;
            const techsCount = branchStaff.filter((p) => p.branch_id === branch.id && p.role === "technician").length;
            const activeBranchJobs = branchJobs.filter(
              (j) => j.branch_id === branch.id && j.status !== "completed" && j.status !== "cancelled"
            ).length;

            return (
              <div key={branch.id} className="glass-card flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-display text-xl font-bold text-white">{branch.name}</h2>
                      <p className="mt-1 text-xs font-mono text-muted">{branch.id}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                      Active
                    </span>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-start gap-3 text-sm text-muted">
                      <MapPin className="mt-0.5 shrink-0 text-brand-red" size={16} />
                      <span>{branch.address}</span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-muted">
                      <Phone className="shrink-0 text-brand-red" size={16} />
                      <span>{branch.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 border-t border-border pt-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-md bg-white/5 p-3">
                      <p className="text-xs font-medium text-muted">BRANCH ADMINS</p>
                      <p className="mt-1 font-display text-lg font-bold text-white">{adminsCount}</p>
                    </div>
                    <div className="rounded-md bg-white/5 p-3">
                      <p className="text-xs font-medium text-muted">TECHNICIANS</p>
                      <p className="mt-1 font-display text-lg font-bold text-white">{techsCount}</p>
                    </div>
                    <div className="rounded-md bg-white/5 p-3">
                      <p className="text-xs font-medium text-muted">ACTIVE JOBS</p>
                      <p className="mt-1 font-display text-lg font-bold text-white">{activeBranchJobs}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
