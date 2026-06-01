"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchApi } from "@/lib/client-api";

type CustomerDetail = {
  id: string;
  full_name: string;
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

export default function CustomerTimelinePage() {
  const params = useParams();
  const customerId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
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
        const [customerPayload, timelinePayload] = await Promise.all([
          fetchApi<CustomerDetail>(`/api/v1/customers/${customerId}`),
          fetchApi<CustomerTimelineResponse>(`/api/v1/customers/${customerId}/timeline`),
        ]);

        if (!active) {
          return;
        }

        setCustomer(customerPayload);
        setTimeline(timelinePayload.timeline ?? []);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load customer timeline");
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
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted">
        <Loader2 className="mr-2 animate-spin text-brand-red" />
        Loading activity ledger...
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
          {error ?? "Customer timeline not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-red">Activity Ledger Timeline</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white">
            {customer.full_name}
          </h1>
        </div>
        <Link
          href={`/branch/customers/${customer.id}`}
          className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
        >
          Back to Profile
        </Link>
      </div>

      <div className="glass-card p-6">
        <div className="space-y-6">
          {timeline.length > 0 ? (
            timeline.map((event, index) => (
              <div key={`${event.reference_id}-${index}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-brand-red" />
                  {index < timeline.length - 1 ? <div className="mt-2 h-full w-px bg-border" /> : null}
                </div>
                <div className="pb-6">
                  <p className="text-xs uppercase tracking-wider text-muted">{formatDateTime(event.timestamp)}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{event.description}</p>
                  <p className="mt-1 text-xs text-brand-red">{event.event_type.replaceAll("_", " ")}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-muted">No customer activity has been recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
