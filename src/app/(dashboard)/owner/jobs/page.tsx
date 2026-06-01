"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Info, Loader2, Plus, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type JobCard = {
  id: string;
  status: string;
  notes: string | null;
  branch_id: string;
  car: {
    license_plate: string;
    make: string;
    model: string;
  } | null;
  customer: {
    full_name: string;
  } | null;
};

type JobRow = Omit<JobCard, "car" | "customer"> & {
  car: { license_plate: string; make: string; model: string } | { license_plate: string; make: string; model: string }[] | null;
  customer: { full_name: string } | { full_name: string }[] | null;
};

type Technician = {
  id: string;
  full_name: string;
  role: "technician";
};

type CustomerOption = {
  id: string;
  full_name: string;
  branch_id: string;
};

type CarOption = {
  id: string;
  customer_id: string;
  license_plate: string;
  make: string;
  model: string;
};

type Branch = {
  id: string;
  name: string;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

const mapJobs = (rows: JobRow[] | null) =>
  (rows ?? []).map((job) => ({
    ...job,
    car: firstRelation(job.car),
    customer: firstRelation(job.customer),
  }));

export default function OwnerJobsPage() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterBranchId, setFilterBranchId] = useState("");
  const [jobModal, setJobModal] = useState(() => searchParams.get("open_create") === "1");
  const [assignModal, setAssignModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(() => searchParams.get("customer_id") ?? "");
  const [carId, setCarId] = useState(() => searchParams.get("car_id") ?? "");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const [techId, setTechId] = useState("");
  const [assignRole, setAssignRole] = useState<"lead_technician" | "assistant_technician">("assistant_technician");
  const [assigning, setAssigning] = useState(false);

  const supabase = createClient();

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch branches, technicians, cars, and customers in parallel
      const [
        { data: branchRows, error: branchesError },
        { data: technicianRows, error: techniciansError },
        { data: carRows, error: carsError },
        { data: customerRows, error: customersError },
      ] = await Promise.all([
        supabase.from("branches").select("id, name").is("deleted_at", null).order("name"),
        supabase.from("profiles").select("id, full_name, role").eq("role", "technician").is("deleted_at", null).order("full_name"),
        supabase.from("cars").select("id, customer_id, license_plate, make, model").is("deleted_at", null).order("license_plate"),
        supabase.from("customers").select("id, full_name, branch_id").is("deleted_at", null).order("full_name"),
      ]);

      if (branchesError) throw new Error(branchesError.message);
      if (techniciansError) throw new Error(techniciansError.message);
      if (carsError) throw new Error(carsError.message);
      if (customersError) throw new Error(customersError.message);

      setBranches(branchRows ?? []);
      setTechnicians((technicianRows ?? []) as Technician[]);
      setCars((carRows ?? []) as CarOption[]);
      setCustomers((customerRows ?? []) as CustomerOption[]);

      // Fetch jobs
      let jobQuery = supabase
        .from("jobs")
        .select("id, status, notes, branch_id, car:cars(license_plate, make, model), customer:customers(full_name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filterBranchId) {
        jobQuery = jobQuery.eq("branch_id", filterBranchId);
      }

      const { data: jobRows, error: jobsError } = await jobQuery;
      if (jobsError) throw new Error(jobsError.message);

      setJobs(mapJobs((jobRows ?? []) as JobRow[]));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [supabase, filterBranchId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Filter cars list in modal based on selected customer
  const customerCars = cars.filter((c) => c.customer_id === customerId);

  async function handleCreateJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          customer_id: customerId,
          car_id: carId,
          notes: notes || null,
        }),
      });

      const payload = (await response.json()) as JobCard & {
        error?: { message: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to create job ticket");
      }

      setJobModal(false);
      setCustomerId("");
      setCarId("");
      setNotes("");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create job ticket");
    } finally {
      setCreating(false);
    }
  }

  async function handleAssignTechnician(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId || !techId) return;

    setAssigning(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/jobs/${selectedJobId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          profile_id: techId,
          assigned_role: assignRole,
        }),
      });

      const payload = (await response.json()) as { error?: { message: string } };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to assign technician");
      }

      setAssignModal(false);
      setTechId("");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to assign technician");
    } finally {
      setAssigning(false);
    }
  }

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            ACTIVE <span className="text-brand-red">HQ JOBS</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Global tracking of workshop job cards, schedules, and repair statuses</p>
        </div>
        <button
          onClick={() => setJobModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover"
        >
          <Plus size={16} /> Open Job Ticket
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">{error}</div>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-center glass-card p-4">
        <div className="flex-1 text-muted text-sm flex items-center gap-2">
          <Info size={16} className="text-brand-red" />
          <span>Showing all active workshop job sheets. Click on a job to view specifications.</span>
        </div>
        <div className="w-full md:w-64">
          <select
            className="brand-input w-full"
            value={filterBranchId}
            onChange={(event) => setFilterBranchId(event.target.value)}
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-red mr-2" />
            <span className="text-muted">Loading jobs pipeline...</span>
          </div>
        ) : jobs.length > 0 ? (
          jobs.map((job) => (
            <div key={job.id} className="glass-card flex flex-col justify-between p-6">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded bg-white/5 px-2 py-1 text-xxs font-semibold uppercase tracking-wider text-muted border border-border">
                      {branchMap.get(job.branch_id) ?? "HQ"}
                    </span>
                    <h3 className="mt-2 font-display text-lg font-bold text-white">Job #{job.id.substring(0, 8)}</h3>
                    <p className="mt-1 text-sm text-muted">{job.customer?.full_name ?? "Walk-In Customer"}</p>
                  </div>
                  <span className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs font-semibold text-white uppercase">
                    {job.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-4 border-t border-border/40 pt-4 space-y-2 text-sm text-muted">
                  <p>
                    Vehicle: <span className="font-semibold text-white">{job.car ? `${job.car.make} ${job.car.model}` : "N/A"}</span>
                  </p>
                  <p>
                    Plate: <span className="font-mono text-white">{job.car?.license_plate ?? "N/A"}</span>
                  </p>
                  {job.notes ? (
                    <p className="line-clamp-2 italic text-muted/80">Notes: &ldquo;{job.notes}&rdquo;</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-border/40">
                <Link
                  href={`/owner/jobs/${job.id}`}
                  className="flex-1 text-center rounded-md border border-border bg-card py-2 text-xs font-bold text-white hover:bg-white/5"
                >
                  Configure Specifications
                </Link>
                <button
                  onClick={() => {
                    setSelectedJobId(job.id);
                    setAssignModal(true);
                  }}
                  className="rounded-md border border-brand-red/20 bg-brand-red/5 p-2 text-brand-red hover:bg-brand-red/10"
                  title="Assign Technician"
                >
                  <Users size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-background/40 py-16 text-center text-sm text-muted">
            No active jobs in this branch pipeline.
          </div>
        )}
      </div>

      {/* Open Job Ticket Modal */}
      {jobModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white">OPEN JOB TICKET</h2>
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Select Customer</label>
                <select
                  required
                  className="brand-input w-full"
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                    setCarId("");
                  }}
                >
                  <option value="">Select Customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({branchMap.get(c.branch_id) ?? "HQ"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Select Vehicle</label>
                <select
                  required
                  className="brand-input w-full"
                  value={carId}
                  onChange={(event) => setCarId(event.target.value)}
                  disabled={!customerId}
                >
                  <option value="">Select Vehicle...</option>
                  {customerCars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.make} {c.model} ({c.license_plate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Diagnostic Notes / Scope</label>
                <textarea
                  className="brand-input w-full h-24 resize-none"
                  placeholder="Describe repair, coating specs, wrap category..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setJobModal(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {creating ? <Loader2 className="animate-spin" size={14} /> : null}
                  Open Job Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Assign Technician Modal */}
      {assignModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white">ASSIGN STAFF TO JOB</h2>
            <form onSubmit={handleAssignTechnician} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Select Technician</label>
                <select
                  required
                  className="brand-input w-full"
                  value={techId}
                  onChange={(event) => setTechId(event.target.value)}
                >
                  <option value="">Select Technician...</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Assigned Duty Role</label>
                <select
                  className="brand-input w-full"
                  value={assignRole}
                  onChange={(event) => setAssignRole(event.target.value as "lead_technician" | "assistant_technician")}
                >
                  <option value="lead_technician">Lead Specialist / Technician</option>
                  <option value="assistant_technician">Assistant specialist</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setAssignModal(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {assigning ? <Loader2 className="animate-spin" size={14} /> : null}
                  Assign Shift Duty
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
