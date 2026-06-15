"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { Plus, Search, Edit2, Loader2, PackageX } from "lucide-react";

export default function InventoryClient({ products }: { products: any[] }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/inventory");
      const data = await res.json();
      if (data.data) {
        setInventory(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct || quantity === "" || quantity < 0) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/agent/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productDetailId: selectedProduct, quantity: Number(quantity) }),
      });
      if (res.ok) {
        await fetchInventory();
        setIsModalOpen(false);
        setQuantity("");
        setSelectedProduct("");
      } else {
        toast.error("Có lỗi xảy ra khi lưu");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mở modal sửa kho
  const handleEdit = (item: any) => {
    setSelectedProduct(String(item.productDetailId));
    setQuantity(item.quantity);
    setIsModalOpen(true);
  };

  const inventoryProductIds = new Set(inventory.map((item) => String(item.productDetailId)));
  const availableProducts = products.filter((p) => {
    const productId = String(p.detail?.id ?? "");
    return !inventoryProductIds.has(productId) || productId === selectedProduct;
  });

  const filteredInventory = inventory.filter((item) =>
    item.productDetail.product.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Tìm trong kho..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <button
          onClick={() => {
            setSelectedProduct("");
            setQuantity("");
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 font-medium whitespace-nowrap shadow-sm"
        >
          <Plus size={20} /> Nhập kho
        </button>
      </div>

      {/* Inventory Grid */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-500" /></div>
      ) : filteredInventory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed">
          <PackageX size={48} className="mb-2" />
          <p>Kho hàng đang trống hoặc không tìm thấy.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInventory.map((item) => {
            const p = item.productDetail.product;
            return (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative">
                  {p.imageUrls?.[0] ? (
                    <Image src={p.imageUrls[0]} alt={p.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Image</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{p.name}</h3>
                  <p className="text-sm text-gray-500 truncate">SKU: {p.sku}</p>
                  <div className="mt-1 font-bold text-emerald-600">
                    {item.quantity} <span className="text-sm font-normal">{p.unit}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleEdit(item)}
                  className="p-2 text-gray-400 hover:text-emerald-600 bg-gray-50 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  <Edit2 size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-0">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <h2 className="text-xl font-bold mb-4">Cập nhật kho hàng</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sản phẩm</label>
                <select
                  required
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="" disabled>-- Chọn sản phẩm --</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.detail?.id || ""} disabled={!p.detail?.id}>
                      {p.name} ({p.unit}){!p.detail?.id ? " - Chưa cấu hình chi tiết" : ""}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng tồn thực tế</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Ví dụ: 100"
                  className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 flex justify-center items-center"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Lưu vào kho"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
