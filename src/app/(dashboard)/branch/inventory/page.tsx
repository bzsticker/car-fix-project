"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Boxes, CheckCircle2, Info, Loader2, Plus, RefreshCw, Search, Sliders, Truck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: "wraps" | "exhausts" | "coatings" | "bodykits" | "accessories" | "labor";
  unit_price: number;
  retail_price: number;
};

type Inventory = {
  id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  reorder_level: number;
  created_at: string;
  product: Product | null;
};

type ProfileType = {
  role: string;
  branch_id: string | null;
};

type PendingTransfer = {
  id: string;
  quantity: number;
  notes: string;
  created_at: string;
  creatorName: string;
  productName: string;
  productSku: string;
  sourceBranchName: string;
};

export default function InventoryDashboard() {
  const supabase = createClient();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // Adjust Stock Modal State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [targetInventory, setTargetInventory] = useState<Inventory | null>(null);
  const [adjustChange, setAdjustChange] = useState<number>(1);
  const [adjustType, setAdjustType] = useState<"stock_in" | "manual_adjustment" | "write_off">("stock_in");
  const [adjustNotes, setAdjustNotes] = useState("");

  // Add Catalog Product Modal State
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductBarcode, setNewProductBarcode] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState<"wraps" | "exhausts" | "coatings" | "bodykits" | "accessories" | "labor">("wraps");
  const [newProductCost, setNewProductCost] = useState<number>(0);
  const [newProductRetail, setNewProductRetail] = useState<number>(0);

  // Initiate Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSourceInv, setTransferSourceInv] = useState<Inventory | null>(null);
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferDestBranchId, setTransferDestBranchId] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

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

      // 2. Fetch inventory list via API to enforce isolation
      const branchQuery = userProfile?.branch_id ? `&filter_branch_id=${userProfile.branch_id}` : "";
      const response = await fetch(`/api/v1/inventory?limit=100${branchQuery}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to fetch inventory list");
      }
      const activeInventories = (payload.data ?? []) as Inventory[];
      setInventories(activeInventories);

      // 3. Fetch other branches for transfer selector
      const { data: branchData } = await supabase
        .from("branches")
        .select("id, name")
        .is("deleted_at", null);
      if (branchData) {
        setBranches(branchData.filter((b) => b.id !== userProfile?.branch_id));
      }

      // 4. Fetch and compute active pending incoming transfers destined for our branch
      if (userProfile?.branch_id) {
        // Fetch all transfer_out movements in the system
        const { data: outMovements } = await supabase
          .from("stock_movements")
          .select("*, inventory:inventories(id, branch_id, branch:branches(name), product:products(name, sku)), creator:profiles(full_name)")
          .eq("type", "transfer_out");

        // Fetch received transfer_in movements to exclude already received ones
        const { data: inMovements } = await supabase
          .from("stock_movements")
          .select("reference_id")
          .eq("type", "transfer_in");

        const receivedIds = new Set(inMovements?.map((m) => m.reference_id).filter(Boolean) ?? []);

        // Filter outMovements where notes contain 'transfer_to:<inventory_id>'
        // and target inventory_id belongs to current branch
        const myInventoryIds = new Set(activeInventories.map((i) => i.id));
        const activePending: PendingTransfer[] = [];

        if (outMovements) {
          for (const mov of outMovements) {
            const note = mov.notes || "";
            if (note.startsWith("transfer_to:") && !receivedIds.has(mov.id)) {
              const destInvId = note.split("transfer_to:")[1];
              if (myInventoryIds.has(destInvId)) {
                interface MovItem {
                  inventory?: {
                    branch?: { name: string } | null;
                    product?: { name: string; sku: string } | null;
                  } | null;
                  creator?: { full_name: string } | null;
                }
                const nested = mov as unknown as MovItem;
                activePending.push({
                  id: mov.id,
                  quantity: Math.abs(mov.quantity),
                  notes: note,
                  created_at: mov.created_at,
                  creatorName: nested.creator?.full_name ?? "System Operator",
                  productName: nested.inventory?.product?.name ?? "Workshop Material",
                  productSku: nested.inventory?.product?.sku ?? "--",
                  sourceBranchName: nested.inventory?.branch?.name ?? "Other Branch",
                });
              }
            }
          }
        }
        setPendingTransfers(activePending);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database inventory");
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

  // Adjust Stock Submit Handler
  const handleAdjustStock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!targetInventory) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/inventory/adjust", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory_id: targetInventory.id,
          quantity_change: adjustChange,
          adjustment_type: adjustType,
          notes: adjustNotes,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to adjust stock level");
      }

      setSuccess(`Stock adjusted successfully! New level: ${payload.data.inventory.quantity} units.`);
      setAdjustModalOpen(false);
      setAdjustNotes("");
      setAdjustChange(1);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock level");
    } finally {
      setSubmitting(false);
    }
  };

  // Add Catalog Product Submit Handler
  const handleAddProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: newProductSku,
          barcode: newProductBarcode || null,
          name: newProductName,
          category: newProductCategory,
          unit_price: newProductCost,
          retail_price: newProductRetail,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to create catalog product");
      }

      setSuccess(`Product "${newProductSku}" created in catalog successfully!`);
      setProductModalOpen(false);
      setNewProductSku("");
      setNewProductBarcode("");
      setNewProductName("");
      setNewProductCost(0);
      setNewProductRetail(0);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  };

  // Initiate Transfer Submit Handler
  const handleInitiateTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!transferSourceInv) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_inventory_id: transferSourceInv.id,
          destination_branch_id: transferDestBranchId,
          quantity: transferQty,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to initiate transfer");
      }

      setSuccess(`Transfer of ${transferQty} units of "${transferSourceInv.product?.sku}" initiated successfully!`);
      setTransferModalOpen(false);
      setTransferDestBranchId("");
      setTransferQty(1);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate transfer");
    } finally {
      setSubmitting(false);
    }
  };

  // Receive Incoming Shipment Handler
  const handleReceiveShipment = async (sourceMovementId: string) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/inventory/transfers/${sourceMovementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to confirm receipt of shipment");
      }

      setSuccess("Shipment successfully accepted! Local inventory stock levels updated.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to receive transfer");
    } finally {
      setSubmitting(false);
    }
  };

  // Local client filter
  const filtered = inventories.filter((item) => {
    const isMatchingCategory = !filterCategory || item.product?.category === filterCategory;
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return isMatchingCategory;

    const matchesSku = item.product?.sku.toLowerCase().includes(cleanSearch) === true;
    const matchesName = item.product?.name.toLowerCase().includes(cleanSearch) === true;

    return isMatchingCategory && (matchesSku || matchesName);
  });

  const lowStockItems = inventories.filter((item) => item.quantity <= item.reorder_level);
  const lowStockCount = lowStockItems.length;
  const isOwner = profile?.role === "owner";
  const isReadOnly = profile?.role === "technician";

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            INVENTORY <span className="text-brand-red">STOCK</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Inspect real-time stock counts, execute catalog listings, and adjust levels.
          </p>
        </div>

        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={() => void loadData()}
            className="inline-flex items-center justify-center p-2.5 rounded border border-border bg-card text-muted hover:text-white transition-all"
            title="Refresh Ledger"
          >
            <RefreshCw size={15} />
          </button>
          
          {isOwner && (
            <button
              onClick={() => setProductModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded bg-brand-red px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-red-hover transition-all"
            >
              <Plus size={16} /> Add Product to Catalog
            </button>
          )}
        </div>
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
          <div className="rounded bg-brand-red/10 p-3 text-brand-red">
            <Boxes size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-wider">TOTAL ACTIVE SKUs</p>
            <h3 className="font-display text-3xl font-extrabold text-white mt-0.5">{inventories.length} SKUs</h3>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className={`rounded p-3 ${lowStockCount > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-wider">LOW STOCK WARN</p>
            <h3 className="font-display text-3xl font-extrabold text-white mt-0.5">{lowStockCount} SKUs</h3>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className={`rounded p-3 ${pendingTransfers.length > 0 ? "bg-brand-red/10 text-brand-red animate-pulse" : "bg-card text-muted"}`}>
            <Truck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-muted uppercase tracking-wider">PENDING IN TRANSIT</p>
            <h3 className="font-display text-3xl font-extrabold text-white mt-0.5">{pendingTransfers.length} Shipments</h3>
          </div>
        </div>
      </div>

      {/* Low Stock Widget */}
      {lowStockCount > 0 && (
        <div className="glass-card p-5 border-l-4 border-warning space-y-3 bg-warning/5">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle size={16} />
            <h4 className="text-xs font-bold uppercase tracking-wider">CRITICAL LOW STOCK ALERTS</h4>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {lowStockItems.map((item) => (
              <div key={item.id} className="bg-background/60 border border-border p-2.5 rounded text-xs flex justify-between items-center">
                <div>
                  <p className="font-bold text-white leading-snug">{item.product?.name}</p>
                  <p className="text-[10px] text-muted font-mono">{item.product?.sku}</p>
                </div>
                <span className="font-mono text-warning font-bold">{item.quantity} / {item.reorder_level} Units</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Incoming Transfers Panel */}
      {pendingTransfers.length > 0 && !isReadOnly && (
        <div className="glass-card p-5 border-l-4 border-brand-red space-y-4 bg-brand-red/5">
          <div className="flex items-center gap-2 text-brand-red">
            <Truck size={16} />
            <h4 className="text-xs font-bold uppercase tracking-wider">PENDING INCOMING BRANCH SHIPMENTS</h4>
          </div>
          
          <div className="border border-border/80 rounded overflow-hidden">
            <table className="w-full text-left text-xs text-muted">
              <thead className="bg-background text-[10px] font-bold uppercase tracking-wider text-white border-b border-border/80">
                <tr>
                  <th className="px-4 py-2.5">Incoming SKU / Product</th>
                  <th className="px-4 py-2.5">From Branch</th>
                  <th className="px-4 py-2.5 text-center">Amount</th>
                  <th className="px-4 py-2.5">Operator</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pendingTransfers.map((xfr) => (
                  <tr key={xfr.id} className="hover:bg-white/[0.01]">
                    <td className="px-4 py-3 font-medium text-white">
                      <div>{xfr.productName}</div>
                      <div className="text-[10px] text-muted font-mono">{xfr.productSku}</div>
                    </td>
                    <td className="px-4 py-3">{xfr.sourceBranchName}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-white">{xfr.quantity} Units</td>
                    <td className="px-4 py-3">{xfr.creatorName}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => void handleReceiveShipment(xfr.id)}
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 rounded bg-success px-3 py-1.5 text-[10px] font-bold text-white hover:bg-success-hover transition-all disabled:opacity-50"
                      >
                        <CheckCircle2 size={11} /> Confirm Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center glass-card p-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search catalog by SKU or product name..."
            className="brand-input w-full pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="brand-input md:w-48"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="wraps">Vinyl Wraps</option>
          <option value="exhausts">Exhaust Systems</option>
          <option value="coatings">Coatings & Detailing</option>
          <option value="bodykits">Aero Bodykits</option>
          <option value="accessories">Accessories</option>
          <option value="labor">Labor Items</option>
        </select>
      </div>

      {/* Inventory Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-red mr-2" />
          <span className="text-muted">Loading inventory stock levels...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const isLowStock = item.quantity <= item.reorder_level;
              return (
                <div key={item.id} className="glass-card flex flex-col justify-between p-6 space-y-4">
                  
                  {/* Header info */}
                  <div className="border-b border-border pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-border bg-background/50 text-muted">
                        {item.product?.category.replace(/_/g, " ")}
                      </span>
                      
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        isLowStock
                          ? "bg-warning/15 border-warning/30 text-warning animate-pulse"
                          : "bg-success/15 border-success/30 text-success"
                      }`}>
                        {isLowStock ? "LOW STOCK" : "GOOD"}
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-lg font-bold text-white leading-snug">
                      {item.product?.name}
                    </h3>
                    <p className="text-[10px] font-mono text-muted">SKU: {item.product?.sku} {item.product?.barcode ? `| Barcode: ${item.product.barcode}` : ""}</p>
                  </div>

                  {/* Stock Levels Indicator */}
                  <div className="flex flex-col gap-1.5 bg-background/40 border border-border/60 rounded p-3 text-xs text-muted">
                    <div className="flex justify-between">
                      <span>Quantity in Stock:</span>
                      <span className={`font-mono font-bold ${isLowStock ? "text-warning font-extrabold" : "text-white"}`}>
                        {item.quantity} Units
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border/20 pt-1 mt-1 text-[10px]">
                      <span>Reorder Trigger Level:</span>
                      <span className="font-mono">{item.reorder_level} Units</span>
                    </div>
                  </div>

                  {/* Actions Panel */}
                  <div className="flex gap-2 border-t border-border pt-3">
                    <Link
                      href={`/branch/inventory/${item.product_id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-border bg-card py-2 text-xs font-semibold text-white transition-all hover:bg-white/5"
                    >
                      <Info size={13} className="text-brand-red" /> View Ledger
                    </Link>

                    {!isReadOnly && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setTransferSourceInv(item);
                            setTransferModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-border bg-card px-2.5 py-2 text-xs font-semibold text-white transition-all hover:bg-white/5"
                          title="Transfer Stock"
                        >
                          <Truck size={13} className="text-brand-red" />
                        </button>
                        <button
                          onClick={() => {
                            setTargetInventory(item);
                            setAdjustModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/5"
                        >
                          <Sliders size={13} /> Adjust
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center text-sm text-muted">
              No inventory entries match the selected filters.
            </div>
          )}
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustModalOpen && targetInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white uppercase tracking-tight">
              Adjust Stock Level
            </h2>
            <p className="text-xs text-muted mb-4 font-semibold uppercase">Product: <span className="text-white">{targetInventory.product?.name}</span></p>

            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Current Quantity</label>
                <p className="brand-input bg-background/50 border-dashed text-white font-mono font-bold">
                  {targetInventory.quantity} Units
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Quantity Change</label>
                  <input
                    type="number"
                    required
                    className="brand-input w-full font-mono"
                    value={adjustChange}
                    onChange={(e) => setAdjustChange(Number.parseInt(e.target.value, 10) || 0)}
                  />
                  <span className="text-[9px] text-muted">Use negative values to deduct (e.g. -2)</span>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Adjustment Type</label>
                  <select
                    required
                    className="brand-input w-full"
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as "stock_in" | "manual_adjustment" | "write_off")}
                  >
                    <option value="stock_in">Stock In (Purchase)</option>
                    <option value="manual_adjustment">Manual Adjustment</option>
                    <option value="write_off">Write-off (Damaged)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Justification Notes</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Reason for stock adjustments... (Min 5 chars)"
                  className="brand-input w-full text-xs"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Record Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal (Owner Only) */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white uppercase tracking-tight">
              Create Central Catalog Product
            </h2>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">SKU (Unique)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WRAP-3M-SATINBLK"
                    className="brand-input w-full font-mono uppercase"
                    value={newProductSku}
                    onChange={(e) => setNewProductSku(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Barcode (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 8850123456789"
                    className="brand-input w-full font-mono"
                    value={newProductBarcode}
                    onChange={(e) => setNewProductBarcode(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3M Satin Black Vinyl Wrap Roll"
                  className="brand-input w-full"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Category</label>
                  <select
                    required
                    className="brand-input w-full text-xs"
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value as "wraps" | "exhausts" | "coatings" | "bodykits" | "accessories" | "labor")}
                  >
                    <option value="wraps">Vinyl Wraps</option>
                    <option value="exhausts">Exhaust Systems</option>
                    <option value="coatings">Coatings</option>
                    <option value="bodykits">Bodykits</option>
                    <option value="accessories">Accessories</option>
                    <option value="labor">Labor Items</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Cost Price (THB)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="brand-input w-full font-mono"
                    value={newProductCost}
                    onChange={(e) => setNewProductCost(Number.parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">Retail Price (THB)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="brand-input w-full font-mono"
                    value={newProductRetail}
                    onChange={(e) => setNewProductRetail(Number.parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transfer Modal */}
      {transferModalOpen && transferSourceInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-white uppercase tracking-tight">
              Initiate Branch Transfer
            </h2>
            <p className="text-xs text-muted mb-4 font-semibold uppercase">Product: <span className="text-white">{transferSourceInv.product?.name}</span></p>

            <form onSubmit={handleInitiateTransfer} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Available Local Stock</label>
                <p className="brand-input bg-background/50 border-dashed text-white font-mono font-bold">
                  {transferSourceInv.quantity} Units
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Target Destination Branch</label>
                <select
                  required
                  className="brand-input w-full"
                  value={transferDestBranchId}
                  onChange={(e) => setTransferDestBranchId(e.target.value)}
                >
                  <option value="">Select Destination Location...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted">Transfer Quantity</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={transferSourceInv.quantity}
                  className="brand-input w-full font-mono"
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number.parseInt(e.target.value, 10) || 1)}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !transferDestBranchId}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Initiate Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
