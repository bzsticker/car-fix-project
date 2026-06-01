"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Database, History, Loader2, ShieldAlert, TrendingUp } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: "wraps" | "exhausts" | "coatings" | "bodykits" | "accessories" | "labor";
  unit_price: number;
  retail_price: number;
  created_at: string;
};

type Branch = {
  id: string;
  name: string;
  phone: string;
};

type Inventory = {
  id: string;
  branch_id: string;
  quantity: number;
  reorder_level: number;
  branch: Branch | null;
};

type StockMovement = {
  id: string;
  inventory_id: string;
  quantity: number;
  type: "stock_in" | "job_consumption" | "transfer_in" | "transfer_out" | "manual_adjustment" | "write_off";
  notes: string | null;
  created_at: string;
  creator: {
    full_name: string;
  } | null;
};

export default function ProductDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [product, setProduct] = useState<Product | null>(null);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Product Metadata
      const { data: prodData, error: prodError } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (prodError || !prodData) {
        throw new Error(prodError?.message ?? "Central product catalog record not found");
      }
      setProduct(prodData as Product);

      // 2. Fetch inventories across branches (Admin will be isolated by RLS, Owner sees all)
      const { data: invData, error: invError } = await supabase
        .from("inventories")
        .select("*, branch:branches(*)")
        .eq("product_id", id)
        .is("deleted_at", null);

      if (invError) {
        throw new Error(invError.message);
      }
      setInventories(invData as unknown as Inventory[] ?? []);

      // 3. Fetch Stock Movement Ledger for this product
      // We join inventories as !inner to filter movements by product_id
      const { data: movData, error: movError } = await supabase
        .from("stock_movements")
        .select("*, inventory:inventories!inner(*), creator:profiles(full_name)")
        .eq("inventory.product_id", id)
        .order("created_at", { ascending: false });

      if (movError) {
        throw new Error(movError.message);
      }

      interface MovementRow {
        [key: string]: unknown;
        creator?: unknown;
      }

      const formattedMovements = (movData as unknown as MovementRow[] ?? []).map((row) => ({
        ...row,
        creator: Array.isArray(row.creator) ? row.creator[0] : row.creator,
      })) as unknown as StockMovement[];

      setMovements(formattedMovements);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database elements");
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="animate-spin text-brand-red" size={32} />
        <span className="text-muted text-sm font-semibold">Loading product metrics & history...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4 py-8 max-w-4xl mx-auto">
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white flex items-center gap-3">
          <ShieldAlert className="text-brand-red" />
          <span>{error ?? "Requested product profile does not exist."}</span>
        </div>
        <button
          onClick={() => router.push("/branch/inventory")}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
        >
          <ArrowLeft size={14} /> Back to Catalog
        </button>
      </div>
    );
  }

  // Margin analytics
  const cost = product.unit_price;
  const retail = product.retail_price;
  const marginAmt = retail - cost;
  const marginPercent = retail > 0 ? (marginAmt / retail) * 100 : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation Headers */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/branch/inventory")}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
        >
          <ArrowLeft size={14} /> Back to Inventory
        </button>
      </div>

      {/* Main Metadata Sheet */}
      <div className="glass-card p-6 bg-[#111111] space-y-6">
        <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-border bg-background text-brand-red">
              {product.category.toUpperCase()}
            </span>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white mt-1">
              {product.name}
            </h1>
            <p className="text-xs text-muted font-mono">
              SKU: <span className="text-white font-semibold">{product.sku}</span> 
              {product.barcode ? ` | Barcode: ${product.barcode}` : ""}
            </p>
          </div>
        </div>

        {product.description && (
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted mb-1">Catalog Description</h4>
            <p className="text-sm text-white font-sans leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Financial Index & Margin Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-[#181818] border border-border/80 rounded p-4 flex items-center gap-3">
            <div className="rounded bg-brand-red/10 p-2.5 text-brand-red">
              <Database size={18} />
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-muted uppercase tracking-wider">UNIT COST PRICE</p>
              <h4 className="font-mono text-lg font-bold text-white mt-0.5">
                {cost.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-muted">THB</span>
              </h4>
            </div>
          </div>

          <div className="bg-[#181818] border border-border/80 rounded p-4 flex items-center gap-3">
            <div className="rounded bg-success/10 p-2.5 text-success">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-muted uppercase tracking-wider">RETAIL SELLING PRICE</p>
              <h4 className="font-mono text-lg font-bold text-white mt-0.5">
                {retail.toLocaleString("en-US", { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-muted">THB</span>
              </h4>
            </div>
          </div>

          <div className="bg-[#181818] border border-border/80 rounded p-4 flex items-center gap-3">
            <div className="rounded bg-warning/10 p-2.5 text-warning">
              <BarChart3 size={18} />
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-muted uppercase tracking-wider">GROSS PROFIT MARGIN</p>
              <h4 className="font-mono text-lg font-bold text-white mt-0.5">
                {marginPercent.toFixed(1)}% <span className="text-xs font-normal text-muted">({marginAmt.toLocaleString()} THB)</span>
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Levels across locations */}
      <div className="glass-card p-6 bg-[#111111] space-y-4">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider text-muted">STOCK LEVELS BY LOCATION</h2>
        
        <div className="border border-border/80 rounded overflow-hidden">
          <table className="w-full text-left text-xs text-muted">
            <thead className="bg-background text-[10px] font-bold uppercase tracking-wider text-white border-b border-border/80">
              <tr>
                <th className="px-4 py-3">Branch Location</th>
                <th className="px-4 py-3">Phone Contact</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">In Stock (Units)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {inventories.length > 0 ? (
                inventories.map((inv) => {
                  const isLow = inv.quantity <= inv.reorder_level;
                  return (
                    <tr key={inv.id} className="hover:bg-white/[0.01]">
                      <td className="px-4 py-3.5 font-medium text-white">{inv.branch?.name ?? "HQ Central Branch"}</td>
                      <td className="px-4 py-3.5">{inv.branch?.phone ?? "--"}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border ${
                          isLow
                            ? "bg-warning/10 border-warning/30 text-warning"
                            : "bg-success/10 border-success/30 text-success"
                        }`}>
                          {isLow ? "LOW STOCK" : "GOOD"}
                        </span>
                      </td>
                      <td className={`px-4 py-3.5 text-right font-mono font-bold ${isLow ? "text-warning" : "text-white"}`}>
                        {inv.quantity} Units
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted italic">
                    This product is not stocked in any active branch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movement Ledger Timeline */}
      <div className="glass-card p-6 bg-[#111111] space-y-4">
        <div className="flex items-center gap-2">
          <History size={16} className="text-brand-red" />
          <h2 className="text-xs font-bold text-white uppercase tracking-wider text-muted">IMMUTABLE STOCK MOVEMENT LEDGER</h2>
        </div>

        <div className="border border-border/80 rounded overflow-hidden">
          <table className="w-full text-left text-xs text-muted">
            <thead className="bg-background text-[10px] font-bold uppercase tracking-wider text-white border-b border-border/80">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Movement Type</th>
                <th className="px-4 py-3 text-right">Adjustment</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Audit Justification Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {movements.length > 0 ? (
                movements.map((mov) => {
                  const isPositive = mov.quantity > 0;
                  return (
                    <tr key={mov.id} className="hover:bg-white/[0.01]">
                      <td className="px-4 py-3.5">{new Date(mov.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3.5 capitalize font-medium text-white">
                        {mov.type.replace(/_/g, " ")}
                      </td>
                      <td className={`px-4 py-3.5 text-right font-mono font-bold ${isPositive ? "text-success" : "text-brand-red"}`}>
                        {isPositive ? `+${mov.quantity}` : mov.quantity}
                      </td>
                      <td className="px-4 py-3.5">{mov.creator?.full_name ?? "System Automation"}</td>
                      <td className="px-4 py-3.5 max-w-xs truncate text-white" title={mov.notes ?? ""}>
                        {mov.notes ?? "--"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted italic">
                    No historical stock movements tracked for this product yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
