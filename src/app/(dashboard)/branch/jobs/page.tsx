"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { Info, Loader2, Plus, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type JobCard = {
  id: string;
  status: string;
  notes: string | null;
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
};

type CarOption = {
  id: string;
  customer_id: string;
  license_plate: string;
  make: string;
  model: string;
};

type ApiEntity = {
  id: string;
  error?: { message: string };
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export default function JobsPage() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const mapJobs = (rows: JobRow[] | null) =>
    (rows ?? []).map((job) => ({
      ...job,
      car: firstRelation(job.car),
      customer: firstRelation(job.customer),
    }));

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [
        { data: jobRows, error: jobsError },
        { data: technicianRows, error: techniciansError },
        { data: carRows, error: carsError },
        { data: customerRows, error: customersError },
      ] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, status, notes, car:cars(license_plate, make, model), customer:customers(full_name)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("role", "technician")
          .is("deleted_at", null)
          .order("full_name", { ascending: true }),
        supabase
          .from("cars")
          .select("id, customer_id, license_plate, make, model")
          .is("deleted_at", null)
          .order("license_plate", { ascending: true }),
        supabase
          .from("customers")
          .select("id, full_name")
          .is("deleted_at", null)
          .order("full_name", { ascending: true }),
      ]);

      if (jobsError) {
        throw new Error(jobsError.message);
      }

      if (techniciansError) {
        throw new Error(techniciansError.message);
      }

      if (carsError) {
        throw new Error(carsError.message);
      }

      if (customersError) {
        throw new Error(customersError.message);
      }

      setJobs(mapJobs((jobRows ?? []) as JobRow[]));
      setTechnicians((technicianRows ?? []) as Technician[]);
      setCars((carRows ?? []) as CarOption[]);
      setCustomers((customerRows ?? []) as CustomerOption[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const [
          { data: jobRows, error: jobsError },
          { data: technicianRows, error: techniciansError },
          { data: carRows, error: carsError },
          { data: customerRows, error: customersError },
        ] = await Promise.all([
          supabase
            .from("jobs")
            .select("id, status, notes, car:cars(license_plate, make, model), customer:customers(full_name)")
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("role", "technician")
            .is("deleted_at", null)
            .order("full_name", { ascending: true }),
          supabase
            .from("cars")
            .select("id, customer_id, license_plate, make, model")
            .is("deleted_at", null)
            .order("license_plate", { ascending: true }),
          supabase
            .from("customers")
            .select("id, full_name")
            .is("deleted_at", null)
            .order("full_name", { ascending: true }),
        ]);

        if (jobsError) {
          throw new Error(jobsError.message);
        }

        if (techniciansError) {
          throw new Error(techniciansError.message);
        }

        if (carsError) {
          throw new Error(carsError.message);
        }

        if (customersError) {
          throw new Error(customersError.message);
        }

        if (!active) {
          return;
        }

        setJobs(mapJobs((jobRows ?? []) as JobRow[]));
        setTechnicians((technicianRows ?? []) as Technician[]);
        setCars((carRows ?? []) as CarOption[]);
        setCustomers((customerRows ?? []) as CustomerOption[]);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [supabase]);

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
        throw new Error(payload.error?.message ?? "Failed to create job");
      }

      setJobs((currentJobs) => [payload, ...currentJobs]);
      setJobModal(false);
      setCustomerId("");
      setCarId("");
      setNotes("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create job");
    } finally {
      setCreating(false);
    }
  }

  async function handleAssignTechnician(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId) {
      return;
    }

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

      const payload = (await response.json()) as ApiEntity;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to assign technician");
      }

      setAssignModal(false);
      setSelectedJobId(null);
      setTechId("");
      setAssignRole("assistant_technician");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to assign technician");
    } finally {
      setAssigning(false);
    }
  }

  const customerCars = customerId ? cars.filter((car) => car.customer_id === customerId) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            ACTIVE <span className="text-brand-red">JOBS BOARD</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Track vehicle modification tickets and allocate technician teams</p>
        </div>
        <button
          onClick={() => setJobModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover"
        >
          <Plus size={16} /> Create Job Card
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 animate-spin text-brand-red" />
          <span className="text-muted">Loading workshop active jobs...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.length > 0 ? (
            jobs.map((job) => (
              <div key={job.id} className="glass-card flex flex-col justify-between space-y-4 p-6">
                <div className="flex items-start justify-between border-b border-border pb-3">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-widest text-brand-red">
                      Plate: {job.car?.license_plate ?? "--"}
                    </span>
                    <h2 className="mt-0.5 font-display text-lg font-bold text-white">
                      {job.car?.make ?? "Unknown"} {job.car?.model ?? ""}
                    </h2>
                    <p className="text-xs text-muted">Owner: {job.customer?.full_name ?? "--"}</p>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${
                      job.status === "in_progress"
                        ? "border-brand-red/20 bg-brand-red/10 text-brand-red"
                        : "border-warning/20 bg-warning/10 text-warning"
                    }`}
                  >
                    {job.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">Workshop Notes:</p>
                  <p className="line-clamp-2 text-xs text-muted">{job.notes || "No special instructions logged."}</p>
                </div>

                <div className="flex gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setAssignModal(true);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-border bg-card py-2 text-xs font-semibold text-white transition-all hover:bg-white/5"
                  >
                    <Users size={14} className="text-brand-red" />
                    Assign Tech Team
                  </button>
                  <Link
                    href={`/branch/jobs/${job.id}`}
                    className="inline-flex items-center justify-center rounded border border-border bg-card p-2 text-muted hover:text-white"
                  >
                    <Info size={14} />
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-sm text-muted">No active jobs in the workshop.</div>
          )}
        </div>
      )}

      {jobModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white">CREATE WORKSHOP JOB TICKET</h2>
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Select Customer Account</label>
                <select
                  required
                  className="brand-input w-full"
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                    setCarId("");
                  }}
                >
                  <option value="">-- Choose Customer profile --</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Select Customer&apos;s Vehicle</label>
                <select
                  required
                  className="brand-input w-full"
                  value={carId}
                  onChange={(event) => setCarId(event.target.value)}
                >
                  <option value="">-- Choose Car --</option>
                  {customerCars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.license_plate} - {car.make} {car.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Workshop instructions / Notes</label>
                <textarea
                  className="brand-input h-24 w-full"
                  placeholder="e.g. Wrap front hood satin black, complete Q90 heat audit, upload prep photos."
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
                  Create Job Card
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {assignModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white">ALLOCATE JOB CREW</h2>
            <form onSubmit={handleAssignTechnician} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Select Technician</label>
                <select
                  required
                  className="brand-input w-full"
                  value={techId}
                  onChange={(event) => setTechId(event.target.value)}
                >
                  <option value="">-- Choose Shift Worker --</option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Assign Role</label>
                <select
                  required
                  className="brand-input w-full"
                  value={assignRole}
                  onChange={(event) =>
                    setAssignRole(event.target.value as "lead_technician" | "assistant_technician")
                  }
                >
                  <option value="lead_technician">Lead Technician (Primary)</option>
                  <option value="assistant_technician">Assistant Technician</option>
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
                  Assign Team Member
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

