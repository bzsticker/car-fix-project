"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchApi } from "@/lib/client-api";

type JobDetailHeader = {
  id: string;
  status: string;
  car: {
    make: string;
    model: string;
    license_plate: string;
  } | null;
};

type JobTimeline = {
  job_id: string;
  timeline: Array<{
    timestamp: string;
    type: string;
    operator: string | null;
    description: string;
    payload?: Record<string, unknown>;
  }>;
};

type JobImage = {
  id: string;
  image_url: string;
  image_type: string;
  description: string | null;
  created_at: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function JobTimelinePage() {
  const params = useParams();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [job, setJob] = useState<JobDetailHeader | null>(null);
  const [timeline, setTimeline] = useState<JobTimeline["timeline"]>([]);
  const [images, setImages] = useState<JobImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let active = true;

    async function bootstrap() {
      try {
        const [jobPayload, timelinePayload, imagePayload] = await Promise.all([
          fetchApi<JobDetailHeader>(`/api/v1/jobs/${jobId}`),
          fetchApi<JobTimeline>(`/api/v1/jobs/${jobId}/timeline`),
          fetchApi<JobImage[]>(`/api/v1/jobs/${jobId}/images`),
        ]);

        if (!active) {
          return;
        }

        setJob(jobPayload);
        setTimeline(timelinePayload.timeline ?? []);
        setImages(imagePayload);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load job timeline");
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
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted">
        <Loader2 className="mr-2 animate-spin text-brand-red" />
        Loading job milestone timeline...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <Link href="/branch/jobs" className="text-sm text-muted hover:text-white">
          Back to Jobs Board
        </Link>
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">
          {error ?? "Job timeline not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-red">Job Milestone Timeline</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white">#{job.id}</h1>
          <p className="mt-2 text-sm text-muted">
            {job.car?.make} {job.car?.model} [{job.car?.license_plate}] | {job.status.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/branch/jobs/${job.id}`}
            className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
          >
            Back to Job Detail
          </Link>
          <button className="rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover">
            Refresh Timeline
          </button>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-white">PHOTO HIGHLIGHTS</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {images.length > 0 ? (
            images.slice(0, 6).map((image) => (
              <div key={image.id} className="overflow-hidden rounded-lg border border-border bg-background/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.image_url} alt={image.description ?? image.image_type} className="h-40 w-full object-cover" />
                <div className="p-4">
                  <p className="text-xs uppercase tracking-wider text-brand-red">{image.image_type.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-sm text-white">{image.description ?? "No description provided"}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-background/40 p-8 text-center text-sm text-muted">
              No image highlights uploaded yet.
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-white">TIMELINE HIGHLIGHTS</h2>
        <div className="space-y-6">
          {timeline.length > 0 ? (
            timeline.map((event, index) => (
              <div key={`${event.type}-${event.timestamp}-${index}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-brand-red" />
                  {index < timeline.length - 1 ? <div className="mt-2 h-full w-px bg-border" /> : null}
                </div>
                <div className="pb-6">
                  <p className="text-xs uppercase tracking-wider text-muted">{formatDateTime(event.timestamp)}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{event.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    {event.type.replaceAll("_", " ")}
                    {event.operator ? ` by ${event.operator}` : ""}
                  </p>
                  {typeof event.payload?.image_url === "string" ? (
                    <a
                      href={event.payload.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs font-medium text-brand-red hover:text-brand-red-hover"
                    >
                      {String(event.payload.image_url)}
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-muted">No timeline milestones have been recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
