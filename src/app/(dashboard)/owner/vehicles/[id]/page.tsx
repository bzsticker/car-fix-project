"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CarFront, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchApi } from "@/lib/client-api";

type VehicleDetail = {
  id: string;
  license_plate: string;
  province: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vin: string | null;
  customer: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
  };
};

type VehicleHistory = {
  vehicle_id: string;
  jobs: Array<{
    id: string;
    status: string;
    total_amount: number;
    created_at: string;
  }>;
  quotes: Array<{
    id: string;
    status: string;
    total_amount: number;
    created_at: string;
    valid_until: string;
  }>;
  warranties: Array<{
    id: string;
    warranty_code: string;
    status: string;
    start_date: string;
    end_date: string;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(value));
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function OwnerVehicleDetailPage() {
  const params = useParams();
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleId) {
      return;
    }

    let active = true;

    async function bootstrap() {
      try {
        const [vehiclePayload, historyPayload] = await Promise.all([
          fetchApi<VehicleDetail>(`/api/v1/vehicles/${vehicleId}`),
          fetchApi<VehicleHistory>(`/api/v1/vehicles/${vehicleId}/history`),
        ]);

        if (!active) {
          return;
        }

        setVehicle(vehiclePayload);
        setHistory(historyPayload);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load vehicle detail");
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
  }, [vehicleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted">
        <Loader2 className="mr-2 animate-spin text-brand-red" />
        Loading vehicle data sheet...
      </div>
    );
  }

  if (error || !vehicle || !history) {
    return (
      <div className="space-y-4">
        <Link href="/owner/vehicles" className="text-sm text-muted hover:text-white">
          Back to Vehicles
        </Link>
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">
          {error ?? "Vehicle not found"}
        </div>
      </div>
    );
  }

  const activeJob = history.jobs.find((job) => !["completed", "cancelled"].includes(job.status));
  const latestJobs = history.jobs.slice(0, 4);
  const latestWarranty = history.warranties[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-red">Vehicle Data Sheet (HQ)</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white">
            {vehicle.make} {vehicle.model}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Plate {vehicle.license_plate} ({vehicle.province})
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/owner/vehicles"
            className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
          >
            Back to Vehicles
          </Link>
          <Link
            href={`/owner/jobs?customer_id=${vehicle.customer.id}&car_id=${vehicle.id}&open_create=1`}
            className="rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover"
          >
            Create Job Card
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">VEHICLE SPECIFICATIONS</h2>
          <div className="space-y-3 text-sm text-muted">
            <div className="flex items-center gap-2 text-white">
              <CarFront size={16} className="text-brand-red" />
              {vehicle.license_plate} ({vehicle.province})
            </div>
            <div>
              Owner:{" "}
              <Link
                href={`/owner/customers/${vehicle.customer.id}`}
                className="font-medium text-white hover:text-brand-red"
              >
                {vehicle.customer.full_name}
              </Link>
            </div>
            <div>
              Make / Model: <span className="text-white">{vehicle.make} {vehicle.model}</span>
            </div>
            <div>
              Year / Color: <span className="text-white">{vehicle.year} / {vehicle.color}</span>
            </div>
            <div>
              VIN: <span className="font-mono text-white">{vehicle.vin ?? "--"}</span>
            </div>
            <div>
              Contact: <span className="text-white">{vehicle.customer.phone}</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">MODIFICATION HISTORY & ACTIVE JOBS</h2>
            <Link
              href={`/owner/vehicles/${vehicle.id}/history`}
              className="text-sm font-semibold text-brand-red hover:text-brand-red-hover"
            >
              Open Full History
            </Link>
          </div>

          <div className="space-y-4">
            {latestJobs.length > 0 ? (
              latestJobs.map((job) => (
                <div key={job.id} className="rounded-lg border border-border bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Job #{job.id}</p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(job.created_at)} | {formatCurrency(job.total_amount)} THB
                      </p>
                    </div>
                    <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-white">
                      {job.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-4 text-xs">
                    <Link href={`/owner/jobs/${job.id}`} className="text-muted hover:text-white">
                      View Job Detail
                    </Link>
                    <Link href={`/owner/jobs/${job.id}/timeline`} className="text-muted hover:text-white">
                      View Timeline
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No job history has been recorded for this vehicle yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">WARRANTY COVERAGE</h2>
          {latestWarranty ? (
            <div className="rounded-lg border border-success/20 bg-success/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck size={16} className="text-success" />
                {latestWarranty.warranty_code}
              </div>
              <p className="mt-2 text-sm text-muted">
                Status: <span className="font-medium text-success">{latestWarranty.status}</span>
              </p>
              <p className="text-sm text-muted">Expires: {formatDate(latestWarranty.end_date)}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background/40 p-6 text-sm text-muted">
              No active warranty registered for this vehicle.
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">PHOTO LOG ACCESS</h2>
          {activeJob ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">Active job photos and milestone shots are available through the current job timeline.</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/owner/jobs/${activeJob.id}`}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Open Job Detail
                </Link>
                <Link
                  href={`/owner/jobs/${activeJob.id}/timeline`}
                  className="rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover"
                >
                  Open Job Timeline
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background/40 p-6 text-sm text-muted">
              No active job photo log is available right now.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
