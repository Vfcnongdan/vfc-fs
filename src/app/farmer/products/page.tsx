"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  imageUrls: string[];
  unit: string;
  category?: { name: string };
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">🧪 Sản phẩm VFC</h1>
        <div className="flex gap-2">
          {/* Search placeholder */}
          <input type="text" placeholder="Tìm sản phẩm..." className="input-field py-1.5 px-3 max-w-[200px]" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-48 animate-pulse bg-neutral-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {products.map((p) => (
            <div key={p.id} className="card flex flex-col gap-3 p-3 overflow-hidden">
              <div className="aspect-square w-full rounded-xl bg-neutral-100 flex items-center justify-center text-3xl">
                {p.imageUrls[0] ? (
                   // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrls[0]} alt={p.name} className="h-full w-full object-cover rounded-xl" />
                ) : (
                  "🧪"
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-green-600 uppercase tracking-wider">{p.category?.name ?? "VFC"}</span>
                <h3 className="text-sm font-bold text-neutral-800 line-clamp-2 leading-tight min-h-[2.5rem]">{p.name}</h3>
              </div>
              <button className="btn-primary w-full py-2 text-xs">Thêm vào đơn</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
