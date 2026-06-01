import { requireApiAuth } from "@/lib/api/auth";
import { canReadBranch } from "@/lib/api/rbac";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const { profile, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const requestedBranchId = searchParams.get("filter_branch_id");

  // 1. Branch Isolation Validation
  let branchId = profile.branch_id;
  if (profile.role === "owner") {
    branchId = requestedBranchId || null;
  } else if (requestedBranchId && !canReadBranch(profile, requestedBranchId)) {
    return apiError(403, "ERR_FORBIDDEN", "Forbidden branch scope");
  }

  try {
    let query = supabase
      .from("inventories")
      .select("quantity, reorder_level, product:products(*)")
      .is("deleted_at", null);

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data: inventories, error } = await query;
    if (error) return apiError(500, "ERR_INTERNAL", error.message);

    interface InvItem {
      quantity: number;
      reorder_level: number;
      product: {
        unit_price: number;
        retail_price: number;
        category: string;
      } | null;
    }

    const items = (inventories as unknown as InvItem[]) ?? [];

    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let lowStockCount = 0;

    const byCategory: Record<string, { cost: number; retail: number; items: number }> = {};

    for (const item of items) {
      if (item.product) {
        const qty = item.quantity;
        const costPrice = Number(item.product.unit_price) || 0;
        const retailPrice = Number(item.product.retail_price) || 0;
        const cat = item.product.category;

        const costVal = qty * costPrice;
        const retailVal = qty * retailPrice;

        totalCostValuation += costVal;
        totalRetailValuation += retailVal;

        if (qty <= item.reorder_level) {
          lowStockCount++;
        }

        if (!byCategory[cat]) {
          byCategory[cat] = { cost: 0, retail: 0, items: 0 };
        }
        byCategory[cat].cost += costVal;
        byCategory[cat].retail += retailVal;
        byCategory[cat].items += qty;
      }
    }

    return apiSuccess({
      branch_id: branchId ?? "all_branches",
      total_items_in_stock: items.reduce((acc, i) => acc + i.quantity, 0),
      unique_skus_count: items.length,
      stock_valuation_cost: totalCostValuation,
      stock_valuation_retail: totalRetailValuation,
      low_stock_items_count: lowStockCount,
      valuation_by_category: byCategory,
    });
  } catch (err) {
    return apiError(500, "ERR_INTERNAL", err instanceof Error ? err.message : "Failed to load inventory valuation report");
  }
}
