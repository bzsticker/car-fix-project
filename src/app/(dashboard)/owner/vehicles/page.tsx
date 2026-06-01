"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Car, Loader2, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { fetchApi } from "@/lib/client-api";

type CustomerOption = {
  id: string;
  full_name: string;
  branch_id: string;
};

type VehicleCard = {
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
    branch_id?: string;
  } | null;
};

type Branch = {
  id: string;
  name: string;
};

type VehiclesResponse = {
  data: VehicleCard[];
};

export default function OwnerVehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleCard[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [plate, setPlate] = useState("");
  const [province, setProvince] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [color, setColor] = useState("");
  const [vin, setVin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch branches & customers in parallel
      const [{ data: branchRows, error: branchesError }, { data: customerRows, error: customersError }] =
        await Promise.all([
          supabase.from("branches").select("id, name").is("deleted_at", null).order("name"),
          supabase.from("customers").select("id, full_name, branch_id").is("deleted_at", null).order("full_name"),
        ]);

      if (branchesError) throw new Error(branchesError.message);
      if (customersError) throw new Error(customersError.message);

      setBranches(branchRows ?? []);
      setCustomers(customerRows ?? []);

      // Fetch vehicles
      let url = "/api/v1/vehicles?limit=1000";
      if (filterBranchId) {
        url += `&filter_branch_id=${filterBranchId}`;
      }

      const res = await fetchApi<VehiclesResponse>(url);
      setVehicles(res.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load vehicles data");
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

  async function handleRegisterCar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerId) {
      setError("Please select an owner customer");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          customer_id: customerId,
          license_plate: plate,
          province,
          make,
          model,
          year,
          color,
          vin: vin || null,
        }),
      });

      const payload = (await response.json()) as VehicleCard & {
        error?: { message: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to create vehicle");
      }

      setModalOpen(false);
      setCustomerId("");
      setPlate("");
      setProvince("");
      setMake("");
      setModel("");
      setYear(new Date().getFullYear());
      setColor("");
      setVin("");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create vehicle");
    } finally {
      setSubmitting(false);
    }
  }

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const normalizedSearch = search.trim().toLowerCase();
  const filteredVehicles = vehicles.filter((vehicle) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      vehicle.license_plate.toLowerCase().includes(normalizedSearch) ||
      vehicle.make.toLowerCase().includes(normalizedSearch) ||
      vehicle.model.toLowerCase().includes(normalizedSearch) ||
      vehicle.customer?.full_name.toLowerCase().includes(normalizedSearch) === true
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            VEHICLE <span className="text-brand-red">HQ REGISTRY</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Global operations, VIN tracking, and car diagnostics lists</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover"
        >
          <Car size={16} /> Register Vehicle
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">{error}</div>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-center glass-card p-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="brand-input w-full pl-10"
            placeholder="Search license plate, make, model, owner..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
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

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="mr-2 animate-spin text-brand-red" />
            <span className="text-muted">Loading vehicle register ledger...</span>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border text-left">
            <thead className="bg-background/40">
              <tr>
                <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">License Plate</th>
                <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Model Specs</th>
                <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Color/Year</th>
                <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Owner Client</th>
                <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">Branch Location</th>
                <th className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/10">
              {filteredVehicles.length > 0 ? (
                filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="transition-colors hover:bg-white/5">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-white">
                      <div>{vehicle.license_plate}</div>
                      <div className="text-xs text-muted">{vehicle.province}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-white font-medium">
                      {vehicle.make} {vehicle.model}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                      {vehicle.color} ({vehicle.year})
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-white font-semibold">
                      {vehicle.customer?.full_name ?? "Walk-In"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                      <span className="rounded bg-white/5 px-2 py-1 text-xs border border-border">
                        {vehicle.customer?.branch_id ? (branchMap.get(vehicle.customer.branch_id) ?? "HQ") : "HQ"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <Link
                        href={`/owner/vehicles/${vehicle.id}`}
                        className="mr-4 text-brand-red hover:text-brand-red-hover"
                      >
                        View Detail
                      </Link>
                      <Link
                        href={`/owner/vehicles/${vehicle.id}/history`}
                        className="text-muted hover:text-white"
                      >
                        Service History
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted">
                    No vehicles found matching search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white">REGISTER VEHICLE</h2>
            <form onSubmit={handleRegisterCar} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Owner Customer</label>
                <select
                  required
                  className="brand-input w-full"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                >
                  <option value="">Select Customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({branchMap.get(c.branch_id) ?? "HQ"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">License Plate</label>
                  <input
                    type="text"
                    required
                    className="brand-input w-full"
                    placeholder="e.g. กข 1234"
                    value={plate}
                    onChange={(event) => setPlate(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Province</label>
                  <input
                    type="text"
                    required
                    className="brand-input w-full"
                    placeholder="e.g. กรุงเทพฯ"
                    value={province}
                    onChange={(event) => setProvince(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Make</label>
                  <input
                    type="text"
                    required
                    className="brand-input w-full"
                    placeholder="e.g. Honda"
                    value={make}
                    onChange={(event) => setMake(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Model</label>
                  <input
                    type="text"
                    required
                    className="brand-input w-full"
                    placeholder="e.g. Civic Type R"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Model Year</label>
                  <input
                    type="number"
                    required
                    className="brand-input w-full"
                    value={year}
                    onChange={(event) => setYear(Number.parseInt(event.target.value, 10))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Color</label>
                  <input
                    type="text"
                    required
                    className="brand-input w-full"
                    placeholder="e.g. Championship White"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">VIN Code (Optional)</label>
                <input
                  type="text"
                  className="brand-input w-full"
                  placeholder="e.g. JH4DB8..."
                  value={vin}
                  onChange={(event) => setVin(event.target.value)}
                />
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
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin" size={14} /> : null}
                  Register Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
