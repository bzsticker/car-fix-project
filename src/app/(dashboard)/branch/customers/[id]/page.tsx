"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Car, Clock3, Loader2, Phone, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchApi } from "@/lib/client-api";

type CustomerDetail = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  line_user_id: string | null;
  created_at: string;
  branch: {
    id: string;
    name: string;
  } | null;
};

type VehicleSummary = {
  id: string;
  customer_id: string;
  license_plate: string;
  province: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vin: string | null;
  customer: {
    full_name: string;
  } | null;
};

type VehiclesResponse = {
  data: VehicleSummary[];
};

type CustomerTimelineResponse = {
  customer_id: string;
  timeline: Array<{
    timestamp: string;
    event_type: string;
    description: string;
    reference_id: string;
  }>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatEventLabel(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [timeline, setTimeline] = useState<CustomerTimelineResponse["timeline"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) {
      return;
    }

    let active = true;

    async function bootstrap() {
      try {
        const [customerPayload, vehiclesPayload, timelinePayload] = await Promise.all([
          fetchApi<CustomerDetail>(`/api/v1/customers/${customerId}`),
          fetchApi<VehiclesResponse>(`/api/v1/vehicles?customer_id=${customerId}&limit=100`),
          fetchApi<CustomerTimelineResponse>(`/api/v1/customers/${customerId}/timeline`),
        ]);

        if (!active) {
          return;
        }

        setCustomer(customerPayload);
        setVehicles(vehiclesPayload.data ?? []);
        setTimeline(timelinePayload.timeline ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load customer detail");
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
  }, [customerId]);

  const latestEvent = timeline[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted">
        <Loader2 className="mr-2 animate-spin text-brand-red" />
        Loading customer profile...
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <Link href="/branch/customers" className="text-sm text-muted hover:text-white">
          Back to Accounts List
        </Link>
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">
          {error ?? "Customer not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-red">Customer Profile</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white">
            {customer.full_name}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Registered at {customer.branch?.name ?? "Unassigned Branch"} on {formatDateTime(customer.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/branch/customers"
            className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
          >
            Back to Accounts List
          </Link>
          <Link
            href={`/branch/jobs?customer_id=${customer.id}&open_create=1`}
            className="rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover"
          >
            Create Job Ticket
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr,1.2fr]">
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-white">ACCOUNT COORDINATES</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-white">
                <UserRound size={16} className="text-brand-red" />
                <span>{customer.full_name}</span>
              </div>
              <div className="flex items-center gap-3 text-white">
                <Phone size={16} className="text-brand-red" />
                <span>{customer.phone}</span>
              </div>
              <div className="text-muted">Email: {customer.email ?? "--"}</div>
              <div className="text-muted">
                LINE OA:{" "}
                {customer.line_user_id ? (
                  <span className="font-medium text-success">Connected</span>
                ) : (
                  <span className="font-medium text-muted">Unlinked</span>
                )}
              </div>
              <div className="text-muted">Mapped Branch: {customer.branch?.name ?? "--"}</div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-white">TIMELINE HIGHLIGHT</h2>
            <div className="space-y-3">
              <p className="text-sm text-muted">Mapped total events: {timeline.length}</p>
              {latestEvent ? (
                <div className="rounded-md border border-border bg-background/60 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-brand-red">
                    <Clock3 size={14} />
                    {formatEventLabel(latestEvent.event_type)}
                  </div>
                  <p className="mt-2 text-sm text-white">{latestEvent.description}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(latestEvent.timestamp)}</p>
                </div>
              ) : (
                <p className="text-sm text-muted">No activity recorded yet.</p>
              )}
              <Link
                href={`/branch/customers/${customer.id}/timeline`}
                className="inline-flex items-center text-sm font-semibold text-brand-red hover:text-brand-red-hover"
              >
                View Full Activity Timeline
              </Link>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">REGISTERED VEHICLES</h2>
            <span className="text-xs uppercase tracking-wider text-muted">{vehicles.length} vehicles</span>
          </div>

          <div className="space-y-4">
            {vehicles.length > 0 ? (
              vehicles.map((vehicle) => (
                <div key={vehicle.id} className="rounded-lg border border-border bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Car size={16} className="text-brand-red" />
                        {vehicle.make} {vehicle.model}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {vehicle.license_plate} ({vehicle.province}) | {vehicle.color} | {vehicle.year}
                      </p>
                    </div>
                    <Link
                      href={`/branch/vehicles/${vehicle.id}`}
                      className="text-xs font-semibold text-brand-red hover:text-brand-red-hover"
                    >
                      View Detail
                    </Link>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    <Link
                      href={`/branch/vehicles/${vehicle.id}/history`}
                      className="text-muted hover:text-white"
                    >
                      View Car History
                    </Link>
                    <Link
                      href={`/branch/jobs?customer_id=${customer.id}&car_id=${vehicle.id}&open_create=1`}
                      className="text-muted hover:text-white"
                    >
                      Create Job Ticket
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-background/40 p-6 text-center text-sm text-muted">
                No registered vehicles for this customer yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
