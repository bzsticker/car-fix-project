"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchApi } from "@/lib/client-api";

type VehicleDetail = {
  id: string;
  make: string;
  model: string;
  license_plate: string;
  province: string;
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function OwnerVehicleHistoryPage() {
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
          setError(loadError instanceof Error ? loadError.message : "Failed to load vehicle history");
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
        Loading vehicle history...
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
          {error ?? "Vehicle history not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-red">Vehicle History (HQ)</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white">
            {vehicle.make} {vehicle.model}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {vehicle.license_plate} ({vehicle.province})
          </p>
        </div>
        <Link
          href={`/owner/vehicles/${vehicle.id}`}
          className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
        >
          Back to Vehicle Detail
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">JOB HISTORY</h2>
          <div className="space-y-4">
            {history.jobs.length > 0 ? (
              history.jobs.map((job) => (
                <div key={job.id} className="rounded-lg border border-border bg-background/60 p-4">
                  <p className="text-sm font-semibold text-white">Job #{job.id}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(job.created_at)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {job.status.replaceAll("_", " ")} | {formatCurrency(job.total_amount)} THB
                  </p>
                  <div className="mt-3 flex gap-4 text-xs">
                    <Link href={`/owner/jobs/${job.id}`} className="text-muted hover:text-white">
                      Detail
                    </Link>
                    <Link href={`/owner/jobs/${job.id}/timeline`} className="text-muted hover:text-white">
                      Timeline
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No jobs recorded.</p>
            )}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">QUOTE HISTORY</h2>
          <div className="space-y-4">
            {history.quotes.length > 0 ? (
              history.quotes.map((quote) => (
                <div key={quote.id} className="rounded-lg border border-border bg-background/60 p-4">
                  <p className="text-sm font-semibold text-white">Quote #{quote.id}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(quote.created_at)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {quote.status} | {formatCurrency(quote.total_amount)} THB
                  </p>
                  <p className="mt-1 text-xs text-muted">Valid until {formatDateTime(quote.valid_until)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No quotes recorded.</p>
            )}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">WARRANTIES</h2>
          <div className="space-y-4">
            {history.warranties.length > 0 ? (
              history.warranties.map((warranty) => (
                <div key={warranty.id} className="rounded-lg border border-border bg-background/60 p-4">
                  <p className="text-sm font-semibold text-white">{warranty.warranty_code}</p>
                  <p className="mt-1 text-xs text-muted">{warranty.status}</p>
                  <p className="mt-1 text-xs text-muted">
                    {formatDateTime(warranty.start_date)} - {formatDateTime(warranty.end_date)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No active or historical warranty entries recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
