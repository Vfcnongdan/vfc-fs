"use client";

export type MultiSelectProduct = {
  productId: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
};

type Props = {
  label: string;
  emptyText: string;
  products: MultiSelectProduct[];
  selected: Map<string, number>;
  onChange: (next: Map<string, number>) => void;
  defaultQuantity?: number;
};

export function ProductMultiSelect({
  label,
  emptyText,
  products,
  selected,
  onChange,
  defaultQuantity = 1,
}: Props) {
  const toggle = (productId: string, stock: number) => {
    const next = new Map(selected);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.set(productId, Math.min(defaultQuantity, stock));
    }
    onChange(next);
  };

  const setQty = (productId: string, stock: number, raw: string) => {
    const qty = Math.max(1, Math.min(stock, parseInt(raw, 10) || 1));
    const next = new Map(selected);
    next.set(productId, qty);
    onChange(next);
  };

  if (products.length === 0) {
    return (
      <div>
        <label className="mb-1 block text-xs font-bold text-neutral-500 uppercase tracking-wider">
          {label}
        </label>
        <p className="text-xs text-neutral-400 italic py-2">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 block text-xs font-bold text-neutral-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="max-h-44 overflow-y-auto rounded-xl border border-neutral-200 divide-y divide-neutral-100">
        {products.map((p) => {
          const checked = selected.has(p.productId);
          const qty = selected.get(p.productId) ?? defaultQuantity;
          return (
            <label
              key={p.productId}
              className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-neutral-50 ${checked ? "bg-blue-50/60" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.productId, p.stock)}
                className="mt-1 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex justify-between flex-1 min-w-0">
                <div>
                  <p className="text-sm font-semibold text-neutral-800 leading-tight">{p.name}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Còn {p.stock} {p.unit} ·{" "}
                    {new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: "VND",
                    }).format(p.price)}
                    /{p.unit}
                  </p>
                </div>
                {checked && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase">SL</span>
                    <input
                      type="number"
                      min={1}
                      max={p.stock}
                      value={qty}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setQty(p.productId, p.stock, e.target.value)}
                      className="w-20 rounded-lg border border-neutral-200 px-2 py-1 text-sm font-semibold"
                    />
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function selectionTotal(
  products: MultiSelectProduct[],
  selected: Map<string, number>,
): number {
  let total = 0;
  for (const p of products) {
    const qty = selected.get(p.productId);
    if (qty) total += p.price * qty;
  }
  return total;
}

export function mergeSelections(
  _suggested: MultiSelectProduct[],
  _additional: MultiSelectProduct[],
  selectedSuggested: Map<string, number>,
  selectedAdditional: Map<string, number>,
): { productId: string; quantity: number }[] {
  const items: { productId: string; quantity: number }[] = [];
  for (const [productId, quantity] of selectedSuggested) {
    if (quantity > 0) items.push({ productId, quantity });
  }
  for (const [productId, quantity] of selectedAdditional) {
    if (quantity > 0) items.push({ productId, quantity });
  }
  return items;
}
