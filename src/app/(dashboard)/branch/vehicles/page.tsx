"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { Car, Info, Loader2, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type CustomerOption = {
  id: string;
  full_name: string;
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
  } | null;
};

type VehiclePayload = VehicleCard & {
  error?: { message: string };
};

type VehicleRow = Omit<VehicleCard, "customer"> & {
  customer: { full_name: string } | { full_name: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export default function VehiclesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [vehicles, setVehicles] = useState<VehicleCard[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  const mapVehicles = (rows: VehicleRow[] | null) =>
    (rows ?? []).map((vehicle) => ({
      ...vehicle,
      customer: firstRelation(vehicle.customer),
    }));

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [{ data: vehicleRows, error: vehiclesError }, { data: customerRows, error: customersError }] =
        await Promise.all([
          supabase
            .from("cars")
            .select("id, customer_id, license_plate, province, make, model, year, color, vin, customer:customers(full_name)")
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase
            .from("customers")
            .select("id, full_name")
            .is("deleted_at", null)
            .order("full_name", { ascending: true }),
        ]);

      if (vehiclesError) {
        throw new Error(vehiclesError.message);
      }

      if (customersError) {
        throw new Error(customersError.message);
      }

      setVehicles(mapVehicles((vehicleRows ?? []) as VehicleRow[]));
      setCustomers((customerRows ?? []) as CustomerOption[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const [{ data: vehicleRows, error: vehiclesError }, { data: customerRows, error: customersError }] =
          await Promise.all([
            supabase
              .from("cars")
              .select("id, customer_id, license_plate, province, make, model, year, color, vin, customer:customers(full_name)")
              .is("deleted_at", null)
              .order("created_at", { ascending: false }),
            supabase
              .from("customers")
              .select("id, full_name")
              .is("deleted_at", null)
              .order("full_name", { ascending: true }),
          ]);

        if (vehiclesError) {
          throw new Error(vehiclesError.message);
        }

        if (customersError) {
          throw new Error(customersError.message);
        }

        if (!active) {
          return;
        }

        setVehicles(mapVehicles((vehicleRows ?? []) as VehicleRow[]));
        setCustomers((customerRows ?? []) as CustomerOption[]);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load vehicles");
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

  async function handleRegisterCar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      const payload = (await response.json()) as VehiclePayload;
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
            VEHICLE <span className="text-brand-red">REGISTRY</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Search registered cars, VIN codes, and check modification lists</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover"
        >
          <Car size={16} /> Add Vehicle
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">{error}</div>
      ) : null}

      <div className="glass-card flex items-center gap-3 p-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="brand-input w-full pl-10"
            placeholder="Search vehicles by license plate, make, model, owner..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 animate-spin text-brand-red" />
          <span className="text-muted">Loading vehicle registry...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.length > 0 ? (
            filteredVehicles.map((vehicle) => (
              <div key={vehicle.id} className="glass-card flex flex-col justify-between space-y-4 p-6">
                <div className="border-b border-border pb-3">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-brand-red">
                    {vehicle.license_plate} - {vehicle.province}
                  </span>
                  <h2 className="mt-1 font-display text-xl font-bold text-white">
                    {vehicle.make} {vehicle.model}
                  </h2>
                  <p className="text-xs text-muted">Owner: {vehicle.customer?.full_name ?? "--"}</p>
                </div>

                <div className="space-y-1.5 text-xs text-muted">
                  <p>
                    Year: <span className="font-medium text-white">{vehicle.year}</span>
                  </p>
                  <p>
                    Color: <span className="font-medium text-white">{vehicle.color}</span>
                  </p>
                  <p>
                    VIN: <span className="font-mono font-medium text-white">{vehicle.vin || "--"}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <Link
                    href={`/branch/vehicles/${vehicle.id}/history`}
                    className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-white"
                  >
                    <Info size={14} /> Full History
                  </Link>
                  <Link
                    href={`/branch/jobs?customer_id=${vehicle.customer_id}&car_id=${vehicle.id}&open_create=1`}
                    className="rounded border border-brand-red/20 bg-brand-red/10 px-3 py-1.5 text-xs font-bold text-brand-red transition-all hover:bg-brand-red/20"
                  >
                    Create Job Ticket
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-sm text-muted">No vehicles registered matching active filters.</div>
          )}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white">REGISTER NEW VEHICLE</h2>
            <form onSubmit={handleRegisterCar} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Select Car Owner</label>
                <select
                  required
                  className="brand-input w-full"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                >
                  <option value="">-- Choose Customer profile --</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">License Plate</label>
                  <input
                    type="text"
                    required
                    className="brand-input w-full"
                    placeholder="e.g. กข 9999"
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
                    placeholder="e.g. กรุงเทพมหานคร"
                    value={province}
                    onChange={(event) => setProvince(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Make / Brand</label>
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
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Model Name</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Year of Manufacture</label>
                  <input
                    type="number"
                    required
                    className="brand-input w-full"
                    value={year}
                    onChange={(event) => setYear(Number(event.target.value))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Body Color</label>
                  <input
                    type="text"
                    required
                    className="brand-input w-full"
                    placeholder="e.g. White"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">VIN / Chassis Code (Optional)</label>
                <input
                  type="text"
                  className="brand-input w-full font-mono"
                  placeholder="e.g. MRHFL5380NP..."
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

