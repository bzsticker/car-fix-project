"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Loader2, MessageSquareCheck, MessageSquareX, Search, UserPlus } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

type Customer = {
  id: string;
  branch_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  line_user_id: string | null;
};

type Branch = {
  id: string;
  name: string;
};

type CustomersResponse = {
  data: Customer[];
};

export default function OwnerCustomersPage() {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch branches
      const { data: branchData, error: branchError } = await supabase
        .from("branches")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");

      if (branchError) {
        throw new Error(branchError.message);
      }
      setBranches(branchData ?? []);

      // Fetch customers
      let url = "/api/v1/customers?limit=1000";
      if (filterBranchId) {
        url += `&filter_branch_id=${filterBranchId}`;
      }

      const response = await fetch(url, {
        credentials: "same-origin",
      });

      const payload = (await response.json()) as CustomersResponse & {
        error?: { message: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to load customers");
      }

      setCustomers(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load customers");
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

  async function handleCreateCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBranchId) {
      setError("Please select a branch");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          branch_id: selectedBranchId,
          full_name: fullName,
          phone,
          email: email || null,
          line_user_id: lineId || null,
        }),
      });

      const payload = (await response.json()) as Customer & {
        error?: { message: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to create customer");
      }

      setModalOpen(false);
      setFullName("");
      setPhone("");
      setEmail("");
      setLineId("");
      setSelectedBranchId("");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create customer");
    } finally {
      setSubmitting(false);
    }
  }

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const normalizedSearch = search.trim().toLowerCase();
  const filteredCustomers = customers.filter((customer) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      customer.full_name.toLowerCase().includes(normalizedSearch) ||
      customer.phone.includes(search) ||
      customer.email?.toLowerCase().includes(normalizedSearch) === true
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white animate-fade-in">
            {t("CUSTOMER HQ DIRECTORY").split(" ")[0]}{" "}
            <span className="text-brand-red">
              {t("CUSTOMER HQ DIRECTORY").split(" ").slice(1).join(" ")}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t("Global management of customers and LINE OA sync across all branches")}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-hover transition-all duration-200 active:scale-95"
        >
          <UserPlus size={16} /> {t("Register Customer")}
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-center glass-card p-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="brand-input w-full pl-10"
            placeholder={t("Search by name, phone, email...")}
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
            <option value="">{t("All Branches")}</option>
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
            <span className="text-muted">{t("Loading directory records...")}</span>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border text-left">
            <thead className="bg-background/40">
              <tr>
                <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">{t("Name")}</th>
                <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">{t("Branch")}</th>
                <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">{t("Phone")}</th>
                <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">{t("Email")}</th>
                <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">{t("LINE OA Account")}</th>
                <th className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-muted">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/10">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="transition-colors hover:bg-white/5">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-white">
                      {customer.full_name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-white">
                      <span className="rounded bg-white/5 px-2 py-1 text-xs border border-border">
                        {branchMap.get(customer.branch_id) ?? "Unassigned"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">{customer.phone}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">{customer.email || "--"}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {customer.line_user_id ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <MessageSquareCheck size={14} /> {t("Synced")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                          <MessageSquareX size={14} /> {t("Unlinked")}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <Link
                        href={`/owner/customers/${customer.id}`}
                        className="mr-4 text-brand-red hover:text-brand-red-hover"
                      >
                        {t("View Detail")}
                      </Link>
                      <Link
                        href={`/owner/customers/${customer.id}/timeline`}
                        className="text-muted hover:text-white"
                      >
                        {t("Timeline")}
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted">
                    {t("No customer accounts found matching search filters.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass-card bg-card p-6 scale-up">
            <h2 className="mb-4 font-display text-xl font-bold text-white tracking-tight">
              {t("REGISTER CUSTOMER ACCOUNT")}
            </h2>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">{t("Target Branch")}</label>
                <select
                  required
                  className="brand-input w-full"
                  value={selectedBranchId}
                  onChange={(event) => setSelectedBranchId(event.target.value)}
                >
                  <option value="">{t("Select a Branch...")}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">{t("Full Name")}</label>
                <input
                  type="text"
                  required
                  className="brand-input w-full"
                  placeholder={t("e.g. Apinan Speedster")}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">{t("Phone Number")}</label>
                <input
                  type="text"
                  required
                  className="brand-input w-full"
                  placeholder={t("e.g. +6681-555-0199")}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">{t("Email Address")}</label>
                <input
                  type="email"
                  className="brand-input w-full"
                  placeholder={t("e.g. apinan@gmail.com")}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">{t("LINE User ID (Optional)")}</label>
                <input
                  type="text"
                  className="brand-input w-full"
                  placeholder={t("e.g. U1234567890abcdef...")}
                  value={lineId}
                  onChange={(event) => setLineId(event.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5 transition-all duration-200"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50 transition-all duration-200 active:scale-95"
                >
                  {submitting ? <Loader2 className="animate-spin" size={14} /> : null}
                  {t("Register Account")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
