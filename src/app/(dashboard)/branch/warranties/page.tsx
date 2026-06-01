"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Car, Clock, Info, Loader2, Plus, Search, ShieldCheck, User } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  full_name: string;
  phone: string;
};

type CarType = {
  id: string;
  license_plate: string;
  make: string;
  model: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
};

type Warranty = {
  id: string;
  warranty_code: string;
  customer_id: string;
  car_id: string;
  product_id: string;
  job_id: string | null;
  start_date: string;
  end_date: string;
  status: "active" | "expired" | "void";
  customer: Customer | null;
  car: CarType | null;
  product: Product | null;
};

type ProfileType = {
  role: string;
  branch_id: string | null;
};

export default function WarrantiesPage() {
  const supabase = createClient();
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Register Warranty Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [cars, setCars] = useState<CarType[]>([]);
  const [selectedCarId, setSelectedCarId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [jobs, setJobs] = useState<{ id: string; scheduled_start: string; total_amount: number }[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [durationMonths, setDurationMonths] = useState<number>(12);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Auth Profile
      const { data: { user } } = await supabase.auth.getUser();
      let userProfile: ProfileType | null = null;
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role, branch_id")
          .eq("id", user.id)
          .single();
        userProfile = data as ProfileType;
        setProfile(userProfile);
      }

      // 2. Fetch warranties via API to enforce isolation
      const branchQuery = userProfile?.branch_id ? `&filter_branch_id=${userProfile.branch_id}` : "";
      const response = await fetch(`/api/v1/warranties?limit=100${branchQuery}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to fetch warranties registry");
      }
      setWarranties(payload.data ?? []);

      // 3. Pre-load customers & products for registration modal
      const { data: customersData } = await supabase
        .from("customers")
        .select("id, full_name, phone")
        .eq("branch_id", userProfile?.branch_id || "")
        .is("deleted_at", null);
      if (customersData) setCustomers(customersData);

      const { data: productsData } = await supabase
        .from("products")
        .select("id, sku, name")
        .is("deleted_at", null);
      if (productsData) setProducts(productsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database index");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Load cars and jobs for selected customer
  useEffect(() => {
    if (!selectedCustomerId) return;

    const loadCustomerDetails = async () => {
      const { data: carsData } = await supabase
        .from("cars")
        .select("id, license_plate, make, model")
        .eq("customer_id", selectedCustomerId)
        .is("deleted_at", null);
      if (carsData) setCars(carsData);

      const { data: jobsData } = await supabase
        .from("jobs")
        .select("id, scheduled_start, total_amount")
        .eq("customer_id", selectedCustomerId)
        .is("deleted_at", null);
      if (jobsData) setJobs(jobsData);
    };

    void loadCustomerDetails();
  }, [selectedCustomerId, supabase]);

  // Register Submit Handler
  const handleRegisterWarranty = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/warranties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          car_id: selectedCarId,
          product_id: selectedProductId,
          job_id: selectedJobId || null,
          duration_months: durationMonths,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to register warranty");
      }

      setSuccess(`Warranty ${payload.data.warranty_code} registered successfully!`);
      setModalOpen(false);
      setSelectedCustomerId("");
      setSelectedCarId("");
      setSelectedProductId("");
      setSelectedJobId("");
      setDurationMonths(12);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register warranty");
    } finally {
      setSubmitting(false);
    }
  };

  // Local client filter
  const filtered = warranties.filter((item) => {
    const isMatchingStatus = !filterStatus || item.status === filterStatus;
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return isMatchingStatus;

    const matchesCode = item.warranty_code.toLowerCase().includes(cleanSearch);
    const matchesCustomer = item.customer?.full_name.toLowerCase().includes(cleanSearch) === true;
    const matchesLicense = item.car?.license_plate.toLowerCase().includes(cleanSearch) === true;

    return isMatchingStatus && (matchesCode || matchesCustomer || matchesLicense);
  });

  const isReadOnly = profile?.role === "technician";

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            WARRANTY <span className="text-brand-red">REGISTRY</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track active modify warranties, file claims, and audit defect records.
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded bg-brand-red px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-red-hover transition-all self-start sm:self-auto"
          >
            <Plus size={16} /> Register Warranty
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-success/30 bg-success/10 p-4 text-sm text-white">
          {success}
        </div>
      )}

      {/* Stats Board */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded bg-success/10 p-3 text-success">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-wider">ACTIVE COVERAGE</p>
            <h3 className="font-display text-3xl font-extrabold text-white mt-0.5">
              {warranties.filter((w) => w.status === "active").length} Sheets
            </h3>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded bg-brand-red/10 p-3 text-brand-red">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-wider">VOIDED/EXPIRED</p>
            <h3 className="font-display text-3xl font-extrabold text-white mt-0.5">
              {warranties.filter((w) => w.status !== "active").length} Sheets
            </h3>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center glass-card p-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search by code, customer name, license plate..."
            className="brand-input w-full pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="brand-input md:w-48"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="void">Voided</option>
        </select>
      </div>

      {/* Warranty List Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-red mr-2" />
          <span className="text-muted">Loading warranty registry database...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const start = new Date(item.start_date).getTime();
              const end = new Date(item.end_date).getTime();
              const isExpired = now > end || item.status === "expired";
              
              return (
                <div key={item.id} className="glass-card flex flex-col justify-between p-6 space-y-4">
                  
                  {/* Header info */}
                  <div className="border-b border-border pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                        #{item.warranty_code}
                      </span>
                      
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        item.status === "active" && !isExpired
                          ? "bg-success/15 border-success/30 text-success"
                          : "bg-brand-red/15 border-brand-red/30 text-brand-red"
                      }`}>
                        {isExpired ? "EXPIRED" : item.status.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-base font-bold text-white leading-tight">
                      {item.product?.name}
                    </h3>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2 text-xs text-muted">
                    <div className="flex items-center gap-2">
                      <User size={13} className="text-muted" />
                      <span className="font-semibold text-white">{item.customer?.full_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Car size={13} className="text-muted" />
                      <span className="font-semibold text-white uppercase">{item.car?.license_plate}</span>
                    </div>
                  </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-muted font-bold">
                        <span className="flex items-center gap-1"><Clock size={10} /> Active Coverage</span>
                        <span>{isExpired ? "0" : Math.max(0, Math.min(100, ((end - now) / (end - start)) * 100)).toFixed(0)}% remaining</span>
                      </div>
                      <div className="h-1.5 w-full bg-background/50 rounded overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${isExpired ? "bg-brand-red" : "bg-success"}`}
                          style={{ width: `${isExpired ? 100 : Math.max(0, Math.min(100, ((end - now) / (end - start)) * 100))}%` }}
                        />
                      </div>
                    <div className="flex justify-between text-[9px] text-muted">
                      <span>{new Date(item.start_date).toLocaleDateString()}</span>
                      <span>Expires: {new Date(item.end_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions Panel */}
                  <div className="flex gap-2 border-t border-border pt-3">
                    <Link
                      href={`/branch/warranties/${item.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-border bg-card py-2 text-xs font-semibold text-white transition-all hover:bg-white/5"
                    >
                      <Info size={14} className="text-brand-red" /> View Claims Detail
                    </Link>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center text-sm text-muted">
              No warranty records registered matching active filters.
            </div>
          )}
        </div>
      )}

      {/* Register Warranty Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white uppercase tracking-tight">
              Register Modify Warranty
            </h2>

            <form onSubmit={handleRegisterWarranty} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Customer</label>
                <select
                  required
                  className="brand-input w-full"
                  value={selectedCustomerId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setSelectedCustomerId(cid);
                    if (!cid) {
                      setCars([]);
                      setJobs([]);
                    }
                  }}
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Vehicle</label>
                  <select
                    required
                    disabled={!selectedCustomerId}
                    className="brand-input w-full text-xs"
                    value={selectedCarId}
                    onChange={(e) => setSelectedCarId(e.target.value)}
                  >
                    <option value="">Select car...</option>
                    {cars.map((car) => (
                      <option key={car.id} value={car.id}>{car.make} {car.model} ({car.license_plate})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Linked Job Card (Optional)</label>
                  <select
                    disabled={!selectedCustomerId}
                    className="brand-input w-full text-xs"
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                  >
                    <option value="">Select job sheet...</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>Job #{job.id.slice(0, 8).toUpperCase()} ({job.total_amount.toLocaleString()} THB)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Central Catalog Product</label>
                  <select
                    required
                    className="brand-input w-full text-xs"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                  >
                    <option value="">Select catalog product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Warranty Period (Months)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    className="brand-input w-full font-mono text-xs"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(Number.parseInt(e.target.value, 10) || 12)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedCarId || !selectedProductId}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Register Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
