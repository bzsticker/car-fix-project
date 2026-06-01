"use client";

import React, { useEffect, useState } from "react";
import { Calendar as CalendarIcon, Clock, Loader2, Plus, Search, User, Wrench, CheckCircle, XCircle } from "lucide-react";

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

type Appointment = {
  id: string;
  branch_id: string;
  customer_id: string;
  car_id: string | null;
  appointment_date: string;
  service_type: "wrap" | "ceramic" | "exhaust" | "general_checkup";
  status: "pending" | "confirmed" | "cancelled" | "completed_to_job";
  notes: string | null;
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

export default function AppointmentsPage() {
  const supabase = createClient();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [carId, setCarId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [serviceType, setServiceType] = useState<"wrap" | "ceramic" | "exhaust" | "general_checkup">("wrap");
  const [notes, setNotes] = useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get logged-in user profile
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

      // 2. Fetch customers and cars for booking selector
      const [{ data: customerRows }, { data: carRows }] = await Promise.all([
        supabase.from("customers").select("id, full_name, phone").is("deleted_at", null).order("full_name"),
        supabase.from("cars").select("id, customer_id, license_plate, make, model").is("deleted_at", null).order("license_plate")
      ]);

      setCustomers((customerRows ?? []) as CustomerOption[]);
      setCars((carRows ?? []) as CarOption[]);

      // 3. Fetch appointments via API endpoint to enforce RBAC and Branch Isolation
      const branchQuery = userProfile?.branch_id ? `&filter_branch_id=${userProfile.branch_id}` : "";
      const response = await fetch(`/api/v1/appointments?limit=100${branchQuery}`);
      const payload = await response.json();
      
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to fetch appointments");
      }
      setAppointments(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database");
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

  const handleRegisterAppointment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          car_id: carId || null,
          appointment_date: new Date(appointmentDate).toISOString(),
          service_type: serviceType,
          notes: notes || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to register appointment");
      }

      setSuccess("Appointment booked successfully.");
      setModalOpen(false);
      
      // Clear form
      setCustomerId("");
      setCarId("");
      setAppointmentDate("");
      setServiceType("wrap");
      setNotes("");

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register booking");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: "confirmed" | "cancelled") => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/v1/appointments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to update appointment");
      }

      setSuccess(`Appointment status updated to ${newStatus}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleConvertToJob = async (appointment: Appointment) => {
    setError(null);
    setSuccess(null);
    try {
      if (!appointment.car_id) {
        throw new Error("Cannot convert appointment to Job. Vehicle registry is required.");
      }

      // 1. Create Job Ticket via API
      const jobResponse = await fetch("/api/v1/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: appointment.customer_id,
          car_id: appointment.car_id,
          notes: `[Auto-created from Appointment scheduled on ${new Date(appointment.appointment_date).toLocaleString()}] Notes: ${appointment.notes ?? "None"}`,
        }),
      });

      const jobPayload = await jobResponse.json();
      if (!jobResponse.ok) {
        throw new Error(jobPayload.error?.message ?? "Failed to create Job Ticket");
      }

      // 2. Update Appointment status to completed_to_job
      const apptResponse = await fetch(`/api/v1/appointments/${appointment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed_to_job" }),
      });

      const apptPayload = await apptResponse.json();
      if (!apptResponse.ok) {
        throw new Error(apptPayload.error?.message ?? "Failed to bind appointment to Job");
      }

      setSuccess(`Appointment successfully converted into Active Job Ticket!`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert to Job");
    }
  };

  // Filter and search computation
  const filtered = appointments.filter((item) => {
    const isMatchingStatus = !filterStatus || item.status === filterStatus;
    const cleanSearch = search.trim().toLowerCase();
    
    if (!cleanSearch) return isMatchingStatus;

    const matchesName = item.customer?.full_name.toLowerCase().includes(cleanSearch);
    const matchesPlate = item.car?.license_plate.toLowerCase().includes(cleanSearch);
    const matchesService = item.service_type.toLowerCase().includes(cleanSearch);

    return isMatchingStatus && (matchesName || matchesPlate || matchesService);
  });

  // Calculate upcoming 7 days for the schedule agenda view
  const getWeeklySlots = () => {
    const slots: { [key: string]: Appointment[] } = {};
    for (let index = 0; index < 7; index++) {
      const date = new Date();
      date.setDate(date.getDate() + index);
      const dateStr = date.toDateString();
      slots[dateStr] = [];
    }

    appointments.forEach((item) => {
      const itemDateStr = new Date(item.appointment_date).toDateString();
      if (slots[itemDateStr] !== undefined) {
        slots[itemDateStr].push(item);
      }
    });

    return Object.entries(slots);
  };

  const customerCars = customerId ? cars.filter((car) => car.customer_id === customerId) : [];
  const weeklyAgenda = getWeeklySlots();
  const isReadOnly = profile?.role === "technician";

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            APPOINTMENT <span className="text-brand-red">SCHEDULER</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track customer booking pipeline, modify agendas, and launch physical shop workflows.
          </p>
        </div>
        
        {!isReadOnly && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-red-hover hover:scale-[1.01]"
          >
            <Plus size={16} /> Book Appointment
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

      {/* 7-Day Agenda Calendar Widget */}
      <div className="glass-card p-6">
        <h2 className="font-display text-lg font-bold text-white mb-4 flex items-center gap-2">
          <CalendarIcon size={18} className="text-brand-red" /> 7-DAY WORKSHOP AGENDA
        </h2>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
          {weeklyAgenda.map(([dayStr, dayAppts]) => {
            const dateObj = new Date(dayStr);
            const isToday = new Date().toDateString() === dayStr;
            return (
              <div 
                key={dayStr} 
                className={`rounded-lg p-3 border min-h-[140px] flex flex-col justify-between ${
                  isToday 
                    ? "bg-brand-red/10 border-brand-red/40" 
                    : "bg-background border-border"
                }`}
              >
                <div>
                  <p className={`text-xs font-bold ${isToday ? "text-brand-red" : "text-muted"}`}>
                    {dateObj.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                  </p>
                  <p className="text-sm font-extrabold text-white">
                    {dateObj.getDate()} {dateObj.toLocaleDateString("en-US", { month: "short" })}
                  </p>
                  
                  <div className="mt-2 space-y-1">
                    {dayAppts.slice(0, 3).map((item) => (
                      <div 
                        key={item.id} 
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium border ${
                          item.status === "confirmed" 
                            ? "bg-brand-red/20 text-white border-brand-red/30"
                            : item.status === "completed_to_job"
                            ? "bg-success/20 text-success border-success/30"
                            : "bg-card text-muted border-border"
                        }`}
                        title={`${item.customer?.full_name} - ${item.service_type}`}
                      >
                        {new Date(item.appointment_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric", hour12: false })} - {item.customer?.full_name}
                      </div>
                    ))}
                    {dayAppts.length > 3 && (
                      <p className="text-[10px] text-muted text-center">+{dayAppts.length - 3} more</p>
                    )}
                    {dayAppts.length === 0 && (
                      <p className="text-[10px] text-muted italic mt-4 text-center">No bookings</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Appointments List & Controls */}
      <div className="space-y-4">
        {/* Filter Controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center glass-card p-4">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Search appointments by customer name, plate, or services..."
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
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed_to_job">Converted to Job</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* List Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-red mr-2" />
            <span className="text-muted">Loading appointments index...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <div key={item.id} className="glass-card flex flex-col justify-between p-6 space-y-4">
                  
                  {/* Top Row - Date & Status */}
                  <div className="border-b border-border pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-widest text-brand-red flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(item.appointment_date).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false
                        })}
                      </span>
                      
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        item.status === "completed_to_job"
                          ? "bg-success/15 border-success/30 text-success"
                          : item.status === "confirmed"
                          ? "bg-brand-red/15 border-brand-red/30 text-white"
                          : item.status === "cancelled"
                          ? "bg-card border-border text-muted"
                          : "bg-warning/15 border-warning/30 text-warning"
                      }`}>
                        {item.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-lg font-bold text-white capitalize">
                      {item.service_type.replace(/_/g, " ")}
                    </h3>
                  </div>

                  {/* Customer and Car Metadata */}
                  <div className="space-y-2 text-xs text-muted">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-muted" />
                      <div>
                        <p className="font-semibold text-white">{item.customer?.full_name ?? "Walk-in Guest"}</p>
                        <p className="text-[10px]">{item.customer?.phone ?? "--"}</p>
                      </div>
                    </div>

                    {item.car ? (
                      <div className="flex items-center gap-2 border-t border-border/40 pt-2 mt-2">
                        <Wrench size={14} className="text-muted" />
                        <div>
                          <p className="font-semibold text-white uppercase">{item.car.license_plate}</p>
                          <p className="text-[10px]">{item.car.make} {item.car.model}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-border/40 pt-2 mt-2 text-[10px] text-warning italic">
                        No vehicle associated yet.
                      </div>
                    )}
                  </div>

                  {/* Notes Section */}
                  <div className="bg-background/40 border border-border/60 rounded p-3 text-xs text-muted min-h-[50px] leading-relaxed">
                    <p className="font-semibold text-white/80 text-[10px] mb-1">Appointment Notes:</p>
                    <p className="line-clamp-2">{item.notes ?? "No custom specifications logged."}</p>
                  </div>

                  {/* Actions Panel */}
                  {!isReadOnly && item.status !== "completed_to_job" && item.status !== "cancelled" && (
                    <div className="flex gap-2 border-t border-border pt-3">
                      {item.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(item.id, "confirmed")}
                            className="inline-flex items-center justify-center gap-1 rounded bg-brand-red/10 border border-brand-red/20 px-2 py-2 text-xs font-bold text-white hover:bg-brand-red/20 flex-1"
                          >
                            <CheckCircle size={12} className="text-brand-red" /> Confirm
                          </button>
                          
                          <button
                            onClick={() => handleUpdateStatus(item.id, "cancelled")}
                            className="inline-flex items-center justify-center gap-1 rounded border border-border bg-card px-2 py-2 text-xs font-semibold text-muted hover:text-white"
                          >
                            <XCircle size={12} /> Cancel
                          </button>
                        </>
                      )}

                      {(item.status === "confirmed" || item.status === "pending") && (
                        <button
                          onClick={() => handleConvertToJob(item)}
                          disabled={!item.car_id}
                          className="inline-flex items-center justify-center gap-1.5 rounded bg-brand-red px-3 py-2 text-xs font-bold text-white hover:bg-brand-red-hover flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!item.car_id ? "Must associate a vehicle profile first" : ""}
                        >
                          <Wrench size={12} /> Open Job Ticket
                        </button>
                      )}
                    </div>
                  )}

                  {/* Disabled view for finished states */}
                  {(item.status === "completed_to_job" || item.status === "cancelled" || isReadOnly) && (
                    <div className="border-t border-border pt-2 text-[10px] text-center text-muted italic">
                      {item.status === "completed_to_job" ? "Successfully converted to active repair job." : isReadOnly ? "Technician view (Read-only)" : "Booking status has been archived."}
                    </div>
                  )}

                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center text-sm text-muted">
                No active bookings matching query filters.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Book Appointment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white uppercase tracking-tight">
              REGISTER NEW BOOKING
            </h2>
            
            <form onSubmit={handleRegisterAppointment} className="space-y-4">
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
                  <option value="">-- Choose Customer profile --</option>
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
                  className="brand-input w-full"
                  value={carId}
                  onChange={(e) => setCarId(e.target.value)}
                  disabled={!customerId}
                >
                  <option value="">-- Choose Car (Optional) --</option>
                  {customerCars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.license_plate} - {car.make} {car.model}
                    </option>
                  ))}
                </select>
                {!customerId && (
                  <p className="text-[10px] text-warning mt-1">Please select a customer first to load vehicles.</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Booking Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    className="brand-input w-full"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Service Category</label>
                  <select
                    required
                    className="brand-input w-full"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as "wrap" | "ceramic" | "exhaust" | "general_checkup")}
                  >
                    <option value="wrap">Wrapping Service</option>
                    <option value="ceramic">Ceramic Coating</option>
                    <option value="exhaust">Exhaust System</option>
                    <option value="general_checkup">General Tuning Checkup</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Special Requirements / Notes</label>
                <textarea
                  className="brand-input h-24 w-full text-xs"
                  placeholder="e.g. Needs satin titanium wrap on side mirrors, verify delivery date before wrap installation."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                  Book Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
