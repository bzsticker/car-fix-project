import { Package, AlertTriangle, ShieldAlert, BadgeDollarSign, Grid } from "lucide-react";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/server";

export const revalidate = 0;

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  retail_price: number | string;
};

type InventoryRow = {
  id: string;
  quantity: number;
  reorder_level: number;
  product_id: string;
  branch_id: string;
};

export default async function OwnerStockPage() {
  const supabase = createAdminClient();

  // Fetch inventories, products, and branches separately to maximize query robustness
  const [
    { data: stock, error: stockError },
    { data: products },
    { data: branches }
  ] = await Promise.all([
    supabase.from("inventories").select("*").is("deleted_at", null),
    supabase.from("products").select("id, sku, name, category, retail_price").is("deleted_at", null),
    supabase.from("branches").select("id, name").is("deleted_at", null),
  ]);

  if (stockError) {
    return (
      <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-6 text-white">
        <h2 className="text-lg font-bold">Error loading inventory stock</h2>
        <p className="text-sm text-muted">Please refresh the page or contact system support.</p>
      </div>
    );
  }

  const productMap = new Map(((products ?? []) as ProductRow[]).map((p) => [p.id, p]));
  const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const normalizedStock = ((stock ?? []) as InventoryRow[]).map((item) => {
    const product = productMap.get(item.product_id);
    const branchName = branchMap.get(item.branch_id) ?? "Unknown Branch";
    return {
      ...item,
      product,
      branchName,
    };
  });

  const totalItems = normalizedStock.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalAssetValue = normalizedStock.reduce((acc, curr) => {
    const price = Number(curr.product?.retail_price ?? 0);
    return acc + curr.quantity * price;
  }, 0);

  const lowStockItems = normalizedStock.filter((item) => item.quantity <= item.reorder_level);
  const outOfStockCount = normalizedStock.filter((item) => item.quantity === 0).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            GLOBAL <span className="text-brand-red">INVENTORY STOCK</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Centralized stock control, branch distribution, and reorder levels</p>
        </div>
        <Link
          href="/owner"
          className="self-start rounded-md border border-border bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/10"
        >
          &larr; Back to Overview
        </Link>
      </div>

      {/* Stock Alert Banner */}
      {lowStockItems.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="shrink-0 text-warning" size={24} />
          <div>
            <h4 className="font-semibold text-white">Critical Stock Warning</h4>
            <p className="text-sm text-muted">
              There are {lowStockItems.length} items currently at or below low stock reorder thresholds (including {outOfStockCount} out of stock).
            </p>
          </div>
        </div>
      ) : null}

      {/* Stock KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>TOTAL PHYSICAL UNITS</span>
            <Package className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">{totalItems}</p>
          <p className="mt-1 text-xs text-muted">Sum of all parts and films across branches</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>GLOBAL ASSET ESTIMATION</span>
            <BadgeDollarSign className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">
            {totalAssetValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
          </p>
          <p className="mt-1 text-xs text-muted">Retail asset value of on-hand inventory</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between text-sm font-medium text-muted">
            <span>LOW STOCK ALERTS</span>
            <AlertTriangle className="text-brand-red" size={20} />
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-white">{lowStockItems.length}</p>
          <p className="mt-1 text-xs text-muted">Items requiring immediate reordering</p>
        </div>
      </div>

      {/* Global Stock Table */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-bold text-white">CENTRALIZED INVENTORY STOCK SHEET</h2>
        </div>

        {normalizedStock.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldAlert className="mb-4 text-muted" size={48} />
            <h3 className="text-lg font-bold text-white">No Inventory Items Found</h3>
            <p className="mt-1 text-sm text-muted">Configure branch inventories to display central stock data.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-muted">
              <thead className="bg-white/5 text-xs font-semibold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-6 py-4">Product Details</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Branch Location</th>
                  <th className="px-6 py-4">Stock Quantity</th>
                  <th className="px-6 py-4">Reorder Threshold</th>
                  <th className="px-6 py-4 text-right">Asset Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {normalizedStock.map((item) => {
                  const isOutOfStock = item.quantity === 0;
                  const isLowStock = item.quantity <= item.reorder_level;
                  const price = Number(item.product?.retail_price ?? 0);
                  const assetValue = item.quantity * price;

                  return (
                    <tr key={item.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">
                          {item.product?.name ?? "Unknown Product"}
                        </div>
                        <div className="text-xs font-mono text-muted mt-0.5">
                          SKU: {item.product?.sku ?? "N/A"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-xs text-white uppercase tracking-wider">
                          <Grid size={12} className="text-brand-red" />
                          <span>{item.product?.category ?? "General"}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-white">
                        {item.branchName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-display text-base font-extrabold ${
                              isOutOfStock
                                ? "text-brand-red"
                                : isLowStock
                                ? "text-warning"
                                : "text-white"
                            }`}
                          >
                            {item.quantity} units
                          </span>
                          {isOutOfStock ? (
                            <span className="rounded bg-brand-red/10 border border-brand-red/20 px-1.5 py-0.2 text-[10px] font-bold text-brand-red">
                              OUT
                            </span>
                          ) : isLowStock ? (
                            <span className="rounded bg-warning/10 border border-warning/20 px-1.5 py-0.2 text-[10px] font-bold text-warning">
                              LOW
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-semibold text-white">
                        {item.reorder_level} units
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-white">
                        {assetValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
