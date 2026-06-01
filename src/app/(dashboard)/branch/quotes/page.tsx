"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Info, Loader2, Plus, Search, Trash2, User, Wrench } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type CustomerOption = {
  id: string;
  full_name: string;
  phone: string;
};

type CarOption = {
  id: string;
  customer_id: string;
  license_plate: string;
  make: string;
  model: string;
};

type QuoteItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  item_type: "service" | "part";
};

type Quote = {
  id: string;
  branch_id: string;
  customer_id: string;
  car_id: string;
  status: "draft" | "sent" | "approved" | "rejected" | "expired";
  valid_until: string;
  total_amount: number;
  created_at: string;
  customer: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
  car: {
    id: string;
    license_plate: string;
    make: string;
    model: string;
  } | null;
};

type ProfileType = {
  role: string;
  branch_id: string | null;
};

export default function QuotesPage() {
  const supabase = createClient();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [profile, setProfile] = useState<ProfileType | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [carId, setCarId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<QuoteItemInput[]>([
    { description: "", quantity: 1, unit_price: 0, item_type: "service" }
  ]);

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

      // 2. Fetch customers and cars for booking selectors
      const [{ data: customerRows }, { data: carRows }] = await Promise.all([
        supabase.from("customers").select("id, full_name, phone").is("deleted_at", null).order("full_name"),
        supabase.from("cars").select("id, customer_id, license_plate, make, model").is("deleted_at", null).order("license_plate")
      ]);

      setCustomers((customerRows ?? []) as CustomerOption[]);
      setCars((carRows ?? []) as CarOption[]);

      // 3. Fetch quotations list via API to enforce isolation
      const branchQuery = userProfile?.branch_id ? `&filter_branch_id=${userProfile.branch_id}` : "";
      const response = await fetch(`/api/v1/quotes?limit=100${branchQuery}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to fetch quotes");
      }
      setQuotes(payload.data ?? []);
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

  // Quote items helper functions
  const handleAddItem = () => {
    setItems((current) => [
      ...current,
      { description: "", quantity: 1, unit_price: 0, item_type: "service" }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const handleUpdateItem = <K extends keyof QuoteItemInput>(
    index: number,
    field: K,
    value: QuoteItemInput[K]
  ) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  const handleCreateQuotation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    // Validate that descriptions are filled
    const invalidItem = items.some((item) => !item.description.trim());
    if (invalidItem) {
      setError("Please write descriptions for all estimated items.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/v1/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          car_id: carId,
          valid_until: new Date(validUntil).toISOString(),
          items: items,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to save quotation");
      }

      setSuccess("New Estimate / Quotation registered successfully.");
      setModalOpen(false);

      // Clear Form State
      setCustomerId("");
      setCarId("");
      setValidUntil("");
      setItems([{ description: "", quantity: 1, unit_price: 0, item_type: "service" }]);

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record quotation estimate");
    } finally {
      setSubmitting(false);
    }
  };

  // Search & Filter
  const filtered = quotes.filter((item) => {
    const isMatchingStatus = !filterStatus || item.status === filterStatus;
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return isMatchingStatus;

    const matchesCustomer = item.customer?.full_name.toLowerCase().includes(cleanSearch);
    const matchesPlate = item.car?.license_plate.toLowerCase().includes(cleanSearch);
    const matchesMake = item.car?.make.toLowerCase().includes(cleanSearch);

    return isMatchingStatus && (matchesCustomer || matchesPlate || matchesMake);
  });

  const customerCars = customerId ? cars.filter((car) => car.customer_id === customerId) : [];
  const isReadOnly = profile?.role === "technician";

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            QUOTATION <span className="text-brand-red">LEDGER</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage cost estimates, track customer signatures, and convert approved quotes into active jobs.
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-red-hover hover:scale-[1.01]"
          >
            <Plus size={16} /> Create Estimate
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

      {/* Controls & Search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center glass-card p-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search quotations by owner name, plate, brand..."
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
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* List Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-red mr-2" />
          <span className="text-muted">Loading estimations catalog...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <div key={item.id} className="glass-card flex flex-col justify-between p-6 space-y-4">
                
                {/* Header info */}
                <div className="border-b border-border pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">
                      EST DATE: {new Date(item.created_at).toLocaleDateString()}
                    </span>
                    
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      item.status === "approved"
                        ? "bg-success/15 border-success/30 text-success"
                        : item.status === "sent"
                        ? "bg-brand-red/15 border-brand-red/30 text-white"
                        : item.status === "rejected" || item.status === "expired"
                        ? "bg-card border-border text-muted"
                        : "bg-warning/15 border-warning/30 text-warning"
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <h3 className="mt-2 font-display text-2xl font-extrabold text-white">
                    {item.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-muted">THB</span>
                  </h3>
                </div>

                {/* Metadata */}
                <div className="space-y-2 text-xs text-muted">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-muted" />
                    <div>
                      <p className="font-semibold text-white">{item.customer?.full_name}</p>
                      <p className="text-[10px]">Owner phone: {item.customer?.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-border/40 pt-2 mt-2">
                    <Wrench size={14} className="text-muted" />
                    <div>
                      <p className="font-semibold text-white uppercase">{item.car?.license_plate}</p>
                      <p className="text-[10px]">{item.car?.make} {item.car?.model}</p>
                    </div>
                  </div>
                </div>

                {/* Expiration date */}
                <div className="flex items-center justify-between bg-background/40 border border-border/60 rounded p-2.5 text-xs text-muted">
                  <span className="text-[10px]">Valid Until:</span>
                  <span className={`font-semibold ${new Date(item.valid_until) < new Date() ? "text-brand-red" : "text-white"}`}>
                    {new Date(item.valid_until).toLocaleDateString()}
                  </span>
                </div>

                {/* Actions Panel */}
                <div className="flex gap-2 border-t border-border pt-3">
                  <Link
                    href={`/branch/quotes/${item.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-border bg-card py-2 text-xs font-semibold text-white transition-all hover:bg-white/5"
                  >
                    <Info size={14} className="text-brand-red" /> View Quote Sheet
                  </Link>
                </div>

              </div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-sm text-muted">
              No estimations matching criteria.
            </div>
          )}
        </div>
      )}

      {/* Create Estimate Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl glass-card bg-card p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 font-display text-xl font-bold text-white uppercase tracking-tight">
              CREATE ESTIMATE & QUOTATION
            </h2>

            <form onSubmit={handleCreateQuotation} className="space-y-4">
              
              {/* Customer & Car Picker */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Select Customer</label>
                  <select
                    required
                    className="brand-input w-full"
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      setCarId("");
                    }}
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.full_name} ({cust.phone})
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
                    onChange={(e) => setCarId(e.target.value)}
                    disabled={!customerId}
                  >
                    <option value="">-- Choose Car --</option>
                    {customerCars.map((car) => (
                      <option key={car.id} value={car.id}>
                        {car.license_plate} - {car.make} {car.model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date valid */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Quotation Valid Until</label>
                <input
                  type="datetime-local"
                  required
                  className="brand-input w-full"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>

              {/* Itemized pricing items list */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase">Itemized Services & Materials</h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-red hover:text-brand-red-hover"
                  >
                    <Plus size={12} /> Add Item Row
                  </button>
                </div>

                <div className="space-y-3 max-h-[25vh] overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center bg-background/50 border border-border/60 rounded p-2.5">
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Paint prep corrections, Gyeon Primer..."
                          className="brand-input w-full text-xs"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(index, "description", e.target.value)}
                        />
                      </div>

                      <div className="w-16">
                        <input
                          type="number"
                          required
                          placeholder="Qty"
                          className="brand-input w-full text-xs text-center"
                          value={item.quantity}
                          min={1}
                          onChange={(e) => handleUpdateItem(index, "quantity", Number.parseInt(e.target.value, 10) || 1)}
                        />
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          required
                          placeholder="Price"
                          className="brand-input w-full text-xs"
                          value={item.unit_price}
                          min={0}
                          onChange={(e) => handleUpdateItem(index, "unit_price", Number.parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="w-28">
                        <select
                          required
                          className="brand-input w-full text-xs"
                          value={item.item_type}
                          onChange={(e) => handleUpdateItem(index, "item_type", e.target.value as "service" | "part")}
                        >
                          <option value="service">Service</option>
                          <option value="part">Spare Part</option>
                        </select>
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-muted hover:text-brand-red p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Total amount summary preview */}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs font-semibold text-muted uppercase">Estimated Total Cost:</span>
                  <span className="font-display text-lg font-bold text-white">
                    {calculateTotal().toLocaleString("en-US", { minimumFractionDigits: 2 })} THB
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
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
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin" size={14} /> : null}
                  Save Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
