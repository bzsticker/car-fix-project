"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Barcode, Loader2, Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  retail_price: number;
};

type Customer = {
  id: string;
  full_name: string;
  phone: string;
};

type CartItem = {
  product: Product;
  quantity: number;
  unit_price: number;
};

export default function POSCheckoutPage() {
  const router = useRouter();
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Checkout Form State
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit_card" | "bank_transfer" | "qr_payment">("bank_transfer");
  const [txnRef, setTxnRef] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);

  // Status State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadCheckoutConfig = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Resolve logged in user branch
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No active credentials session found");

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("branch_id")
        .eq("id", user.id)
        .single();

      if (profileErr || !profile?.branch_id) {
        throw new Error("Failed to authenticate branch settings");
      }
      setBranchId(profile.branch_id);

      // 2. Fetch products & branch customers in parallel
      const [
        { data: productsData, error: prodErr },
        { data: customersData, error: custErr },
      ] = await Promise.all([
        supabase.from("products").select("id, sku, barcode, name, retail_price").is("deleted_at", null).order("name"),
        supabase.from("customers").select("id, full_name, phone").eq("branch_id", profile.branch_id).is("deleted_at", null).order("full_name"),
      ]);

      if (prodErr) throw new Error(prodErr.message);
      if (custErr) throw new Error(custErr.message);

      setProducts(productsData ?? []);
      setCustomers(customersData ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load checkout catalog");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCheckoutConfig();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCheckoutConfig]);

  // Barcode quick add
  const handleBarcodeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!barcodeInput.trim()) return;

    const code = barcodeInput.trim().toLowerCase();
    const match = products.find(
      (p) =>
        p.barcode?.toLowerCase() === code ||
        p.sku.toLowerCase() === code
    );

    if (match) {
      addToCart(match);
      setBarcodeInput("");
      setError(null);
    } else {
      setError(`No product registered with barcode/SKU: "${barcodeInput}"`);
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, unit_price: product.retail_price }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return { ...item, quantity: Math.max(1, newQty) };
          }
          return item;
        })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxable = Math.max(0, subtotal - discountAmount);
  const tax = parseFloat((taxable * 0.07).toFixed(2));
  const grandTotal = parseFloat((taxable + tax).toFixed(2));

  // Submit POS Transaction
  const handleCheckoutSubmit = async () => {
    if (cart.length === 0) {
      setError("Cannot check out an empty shopping cart!");
      return;
    }

    if (!branchId) {
      setError("Credentials branch parameters missing!");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      branch_id: branchId,
      customer_id: customerId || null,
      payment_method: paymentMethod,
      transaction_reference: txnRef || null,
      discount_amount: discountAmount,
      items: cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    };

    try {
      const res = await fetch("/api/v1/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Checkout failed");
      }

      setSuccess(`Transaction ${data.data.sales_number} completed successfully!`);
      setCart([]);
      setCustomerId("");
      setTxnRef("");
      setDiscountAmount(0);

      // Redirect back after brief delay
      setTimeout(() => {
        router.push("/branch/pos");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout transaction aborted");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="animate-spin text-brand-red" size={32} />
        <span className="text-muted text-sm">Loading cashier terminal config...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Link
            href="/branch/pos"
            className="inline-flex h-10 w-10 items-center justify-center rounded border border-border text-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-white">POS CHECKOUT</h1>
            <p className="text-xs text-muted">Ring up quick over-the-counter detailing retail orders</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-brand-red/30 bg-brand-red/10 p-4 text-sm text-white">{error}</div>
      ) : null}

      {success ? (
        <div className="rounded-md border border-success/30 bg-success/10 p-4 text-sm text-white">{success}</div>
      ) : null}

      {/* Terminal Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Products & Shopping Cart (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Barcode & Search Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                <Barcode size={16} />
              </div>
              <input
                type="text"
                placeholder="Scan barcode or type SKU..."
                className="brand-input w-full pl-9 font-mono"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
              />
            </form>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Search catalog products by name..."
                className="brand-input w-full pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Quick Product Grid Results */}
          {searchTerm && (
            <div className="glass-card max-h-48 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#111111]/80">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex justify-between items-center rounded border border-border p-3 text-xs text-left bg-card hover:bg-white/5 transition-all text-white"
                  >
                    <div>
                      <p className="font-bold">{p.name}</p>
                      <p className="font-mono text-muted text-[10px]">{p.sku}</p>
                    </div>
                    <span className="font-extrabold text-brand-red">{p.retail_price.toLocaleString()} THB</span>
                  </button>
                ))
              ) : (
                <p className="col-span-full py-4 text-center text-xs text-muted">No products found matching &ldquo;{searchTerm}&rdquo;</p>
              )}
            </div>
          )}

          {/* Shopping Cart List */}
          <div className="glass-card overflow-hidden">
            <div className="border-b border-border bg-background/30 px-6 py-4 flex items-center gap-2">
              <ShoppingCart size={18} className="text-brand-red" />
              <h2 className="font-display text-sm font-bold text-white uppercase tracking-wider">Shopping Cart Basket</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background/40 border-b border-border">
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted">SKU / Product Description</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted text-center w-36">Quantity</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted text-right">Retail Unit</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-muted text-right">Total Price</th>
                    <th className="px-6 py-3.5 text-right w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card/10">
                  {cart.length > 0 ? (
                    cart.map((item) => (
                      <tr key={item.product.id} className="transition-colors hover:bg-white/5">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-white">{item.product.name}</p>
                          <p className="font-mono text-muted text-[10px] mt-0.5">{item.product.sku}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2 border border-border rounded bg-background p-1">
                            <button
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="h-7 w-7 rounded bg-card hover:bg-white/5 flex items-center justify-center text-muted hover:text-white"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="font-mono font-bold text-sm w-8 text-center text-white">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="h-7 w-7 rounded bg-card hover:bg-white/5 flex items-center justify-center text-muted hover:text-white"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-muted">
                          {item.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-white">
                          {(item.quantity * item.unit_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-muted hover:text-brand-red p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-sm text-muted">
                        Checkout terminal shopping cart is currently empty. Scan items or type search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Checkout & Payment Summary (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Checkout Panel */}
          <div className="glass-card p-6 space-y-6">
            <h2 className="font-display text-base font-bold text-white uppercase tracking-wider border-b border-border pb-3">
              Checkout Summary
            </h2>

            {/* Customer Link Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Customer Link (Optional)</label>
              <select
                className="brand-input w-full text-xs"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Guest Walk-in Checkout</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            {/* Price Calculations Ledger */}
            <div className="bg-background/50 border border-border rounded p-4 space-y-3 text-xs text-muted">
              <div className="flex justify-between">
                <span>Subtotal Basket:</span>
                <span className="font-semibold text-white">{subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB</span>
              </div>

              {/* Discount Entry */}
              <div className="flex items-center justify-between gap-4 border-t border-border/20 pt-2.5">
                <span>Discount Entry:</span>
                <div className="flex items-center gap-1.5 w-32">
                  <input
                    type="number"
                    min={0}
                    max={subtotal}
                    placeholder="0"
                    className="brand-input text-right text-xs py-1 px-2 font-bold font-mono text-brand-red"
                    value={discountAmount || ""}
                    onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div className="flex justify-between border-t border-border/20 pt-2.5">
                <span>VAT (7%):</span>
                <span className="font-semibold text-white">{tax.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB</span>
              </div>

              <div className="flex justify-between border-t border-border pt-3 text-white font-bold text-sm">
                <span>Total Due:</span>
                <span className="text-brand-red font-extrabold text-base">{grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} THB</span>
              </div>
            </div>

            {/* Payment Method Toggle Tabs */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Settlement Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "bank_transfer", label: "Bank Trans." },
                  { id: "qr_payment", label: "PromptPay QR" },
                  { id: "cash", label: "Cash" },
                  { id: "credit_card", label: "Credit Card" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as "cash" | "credit_card" | "bank_transfer" | "qr_payment")}
                    className={`rounded border py-2.5 text-center text-xs font-bold uppercase transition-all ${
                      paymentMethod === m.id
                        ? "bg-brand-red border-brand-red text-white"
                        : "bg-card border-border text-muted hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference input for non-cash payments */}
            {paymentMethod !== "cash" && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Transaction Reference ID</label>
                <input
                  type="text"
                  placeholder="e.g. SCB-Ref-18491"
                  className="brand-input w-full font-mono text-xs"
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                />
              </div>
            )}

            {/* Checkout Action Button */}
            <button
              onClick={handleCheckoutSubmit}
              disabled={submitting || cart.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded bg-brand-red py-4 text-xs font-extrabold uppercase tracking-widest text-white hover:bg-brand-red-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? <Loader2 className="animate-spin mr-1" size={16} /> : null}
              [ Complete Cashier Transaction ]
            </button>
          </div>

          {/* Quick catalog helper panel */}
          <div className="glass-card p-6 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Quick Item Add Catalog</h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {products.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full flex items-center justify-between text-left rounded bg-background p-2 text-xxs text-muted hover:text-white transition-colors"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="font-bold text-brand-red font-mono">+{p.retail_price} THB</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
