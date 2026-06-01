"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ImagePlus, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchApi } from "@/lib/client-api";

type JobDetail = {
  id: string;
  branch_id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  created_at: string;
  updated_at: string;
  car: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
  } | null;
  customer: {
    id: string;
    full_name: string;
  } | null;
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    status: string;
    assigned_technician_id: string | null;
    updated_at: string;
  }>;
  parts: Array<{
    id: string;
    sku: string | null;
    product_name: string | null;
    quantity: number;
    total_price: number;
  }>;
  assignments: Array<{
    profile_id: string;
    full_name: string | null;
    assigned_role: string;
  }>;
};

type JobImage = {
  id: string;
  job_id: string;
  image_url: string;
  image_type: string;
  description: string | null;
  uploaded_by: string;
  created_at: string;
  uploader: {
    id: string;
    full_name: string;
    role: string;
  } | null;
};

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "awaiting_parts", label: "Awaiting Parts" },
  { value: "qc", label: "Quality Control" },
  { value: "ready_for_pickup", label: "Ready for Pickup" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function OwnerJobDetailPage() {
  const params = useParams();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [images, setImages] = useState<JobImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("scheduled");
  const [notes, setNotes] = useState("");
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageType, setImageType] = useState("in_progress");
  const [imageDescription, setImageDescription] = useState("");

  const activeImages = useMemo(() => images.slice(0, 4), [images]);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let active = true;

    async function bootstrap() {
      try {
        const [jobPayload, imagePayload] = await Promise.all([
          fetchApi<JobDetail>(`/api/v1/jobs/${jobId}`),
          fetchApi<JobImage[]>(`/api/v1/jobs/${jobId}/images`),
        ]);

        if (!active) {
          return;
        }

        setJob(jobPayload);
        setImages(imagePayload);
        setStatus(jobPayload.status);
        setNotes(jobPayload.notes ?? "");
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load job detail");
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

  async function refreshJobDetail() {
    if (!jobId) {
      return;
    }

    const [jobPayload, imagePayload] = await Promise.all([
      fetchApi<JobDetail>(`/api/v1/jobs/${jobId}`),
      fetchApi<JobImage[]>(`/api/v1/jobs/${jobId}/images`),
    ]);

    setJob(jobPayload);
    setImages(imagePayload);
    setStatus(jobPayload.status);
    setNotes(jobPayload.notes ?? "");
  }

  async function handleSaveWorkflow() {
    if (!jobId) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    setError(null);

    try {
      await fetchApi<JobDetail>(`/api/v1/jobs/${jobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          notes,
        }),
      });

      await refreshJobDetail();
      setSaveMessage("Job workflow updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update job workflow");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jobId) {
      return;
    }

    setUploading(true);
    setError(null);
    setSaveMessage(null);

    try {
      await fetchApi<JobImage>(`/api/v1/jobs/${jobId}/images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: imageUrl,
          image_type: imageType,
          description: imageDescription || null,
        }),
      });

      await refreshJobDetail();
      setImageModalOpen(false);
      setImageUrl("");
      setImageType("in_progress");
      setImageDescription("");
      setSaveMessage("Progress photo added successfully.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload job image");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted">
        <Loader2 className="mr-2 animate-spin text-brand-red" />
        Loading job control sheet...
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="space-y-4">
        <Link href="/owner/jobs" className="text-sm text-muted hover:text-white">
          Back to Jobs Board
        </Link>
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">
          {error}
        </div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-red">Job Control Sheet (HQ)</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white">#{job.id}</h1>
          <p className="mt-2 text-sm text-muted">
            {job.car?.make} {job.car?.model} [{job.car?.license_plate}] for {job.customer?.full_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/owner/jobs"
            className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
          >
            Back to Jobs Board
          </Link>
          <Link
            href={`/owner/jobs/${job.id}/timeline`}
            className="rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover"
          >
            View Timeline
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">{error}</div>
      ) : null}
      {saveMessage ? (
        <div className="rounded-md border border-success/30 bg-success/10 p-4 text-sm text-white">{saveMessage}</div>
      ) : null}

      <div className="rounded-lg border border-border bg-card/60 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Current Status</p>
            <p className="mt-1 text-lg font-semibold text-white">{job.status.replaceAll("_", " ")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted">Workflow Stage</label>
              <select
                className="brand-input min-w-[220px]"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSaveWorkflow}
              disabled={saving}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              Save Job Workflow
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">SERVICE & ASSIGNED TEAM</h2>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background/60 p-4 text-sm text-muted">
              <p className="text-white">Vehicle: {job.car?.make} {job.car?.model} [{job.car?.license_plate}]</p>
              <p className="mt-1">Owner: {job.customer?.full_name ?? "--"}</p>
            </div>
            <div className="rounded-lg border border-border bg-background/60 p-4">
              <p className="text-sm font-semibold text-white">Team</p>
              <div className="mt-3 space-y-2 text-sm text-muted">
                {job.assignments.length > 0 ? (
                  job.assignments.map((assignment) => (
                    <div key={`${assignment.profile_id}-${assignment.assigned_role}`} className="flex items-center justify-between">
                      <span>{assignment.full_name ?? "Unknown Technician"}</span>
                      <span className="text-xs uppercase tracking-wider text-brand-red">
                        {assignment.assigned_role.replaceAll("_", " ")}
                      </span>
                    </div>
                  ))
                ) : (
                  <p>No team members assigned yet.</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background/60 p-4">
              <p className="text-sm font-semibold text-white">Service Tasks</p>
              <div className="mt-3 space-y-3">
                {job.services.length > 0 ? (
                  job.services.map((service) => (
                    <div key={service.id} className="rounded-md border border-border bg-card/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{service.name}</p>
                          <p className="mt-1 text-xs text-muted">{service.description ?? "No additional notes"}</p>
                        </div>
                        <span className="text-xs uppercase tracking-wider text-brand-red">
                          {service.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted">Price: {formatCurrency(service.price)} THB</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">No service tasks added to this job yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">PARTS CONSUMPTION & NOTES</h2>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background/60 p-4">
              <p className="text-sm font-semibold text-white">Parts Ledger</p>
              <div className="mt-3 space-y-3">
                {job.parts.length > 0 ? (
                  job.parts.map((part) => (
                    <div key={part.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-white">{part.product_name ?? part.sku ?? "Unknown Part"}</p>
                        <p className="text-xs text-muted">Qty {part.quantity} | SKU {part.sku ?? "--"}</p>
                      </div>
                      <span className="text-xs text-muted">{formatCurrency(part.total_price)} THB</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">No parts consumption has been recorded yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background/60 p-4">
              <p className="text-sm font-semibold text-white">Workshop Notes</p>
              <textarea
                className="brand-input mt-3 h-32 w-full"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add technician notes, QC remarks, or customer handling details."
              />
            </div>

            <div className="rounded-lg border border-border bg-background/60 p-4 text-sm text-muted">
              <p>Created: {formatDateTime(job.created_at)}</p>
              <p className="mt-1">Updated: {formatDateTime(job.updated_at)}</p>
              <p className="mt-1">Scheduled Start: {formatDateTime(job.scheduled_start)}</p>
              <p className="mt-1">Scheduled End: {formatDateTime(job.scheduled_end)}</p>
              <p className="mt-1">Actual Start: {formatDateTime(job.actual_start)}</p>
              <p className="mt-1">Actual End: {formatDateTime(job.actual_end)}</p>
              <p className="mt-2 text-white font-semibold">Estimated Total: {formatCurrency(job.total_amount)} THB</p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-white">PHOTO LOGS & PROGRESS IMAGES</h2>
            <p className="mt-1 text-sm text-muted">Upload and review before, in-progress, and after photos for this job.</p>
          </div>
          <button
            onClick={() => setImageModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover"
          >
            <ImagePlus size={16} />
            Add Photo Log
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {activeImages.length > 0 ? (
            activeImages.map((image) => (
              <div key={image.id} className="overflow-hidden rounded-lg border border-border bg-background/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.image_url} alt={image.description ?? image.image_type} className="h-44 w-full object-cover" />
                <div className="space-y-1 p-4">
                  <p className="text-xs uppercase tracking-wider text-brand-red">{image.image_type.replaceAll("_", " ")}</p>
                  <p className="text-sm font-semibold text-white">{image.description ?? "No description provided"}</p>
                  <p className="text-xs text-muted">{formatDateTime(image.created_at)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-background/40 p-8 text-center text-sm text-muted">
              No photo logs have been uploaded yet.
            </div>
          )}
        </div>
      </div>

      {imageModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white">ADD JOB PHOTO LOG</h2>
            <form onSubmit={handleUploadImage} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Image URL</label>
                <input
                  type="url"
                  required
                  className="brand-input w-full"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Image Type</label>
                <select className="brand-input w-full" value={imageType} onChange={(event) => setImageType(event.target.value)}>
                  <option value="before">Before</option>
                  <option value="in_progress">In Progress</option>
                  <option value="after">After</option>
                  <option value="qc_fail">QC Fail</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Description</label>
                <textarea
                  className="brand-input h-24 w-full"
                  value={imageDescription}
                  onChange={(event) => setImageDescription(event.target.value)}
                  placeholder="Describe what this image captures."
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setImageModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="animate-spin" size={14} /> : null}
                  Save Photo Log
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
