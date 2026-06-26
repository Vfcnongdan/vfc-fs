"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Search, Power, ChevronLeft, ChevronRight, X } from "lucide-react";

interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  stock: number;
  isActive: boolean;
  unit: string;
  detail?: {
    plantCrops?: string;
    targetDiseases?: string;
    description?: string;
  };
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [page]);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products?page=${page}`);
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch products", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) fetchProducts();
    } catch (error) {
      console.error("Toggle error", error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc chắn muốn xóa sản phẩm này?")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (res.ok) fetchProducts();
    } catch (error) {
      console.error("Delete error", error);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const method = editingProduct?.id ? "PUT" : "POST";
    const url = editingProduct?.id ? `/api/admin/products/${editingProduct.id}` : "/api/admin/products";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProduct),
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchProducts();
      }
    } catch (error) {
      console.error("Save error", error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#064E3B] uppercase tracking-tight">📦 Quản lý Sản phẩm</h1>
          <p className="text-sm text-neutral-500">Danh mục thuốc bảo vệ thực vật và phân bón</p>
        </div>
        <button
          onClick={() => {
            setEditingProduct({ name: "", sku: "", slug: "", unit: "chai", stock: 0, isActive: true });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-bold text-[#FFD680] shadow-lg transition hover:opacity-90 active:scale-95"
        >
          <Plus size={18} />
          <span>Thêm sản phẩm</span>
        </button>
      </div>

      <div className="card overflow-hidden border border-neutral-200 bg-white shadow-sm rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase text-[10px] tracking-widest">
              <tr>
                <th className="px-6 py-4">Sản phẩm</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4 text-center">Tồn kho</th>
                <th className="px-6 py-4 text-center">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-neutral-400">Đang tải...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-neutral-400">Không có sản phẩm nào</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
              <div className="flex flex-col">
                <span className="font-bold text-neutral-800 uppercase text-xs">{p.name}</span>
                <span className="text-[10px] text-neutral-400">SKU: {p.sku} · {p.unit}</span>
              </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-neutral-500">{p.sku}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${p.stock > 10 ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleStatus(p.id, p.isActive)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase transition-all ${
                          p.isActive ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"
                        }`}
                      >
                        <Power size={10} />
                        {p.isActive ? "Đang bán" : "Ngưng"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-blue-600 transition"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-neutral-100 px-6 py-4 bg-neutral-50/50">
          <p className="text-xs text-neutral-500 font-medium">Trang {page} / {totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#064E3B]/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsModalOpen(false)} className="absolute right-6 top-6 text-neutral-400 hover:text-neutral-600">
              <X size={24} />
            </button>
            
            <h2 className="mb-8 text-xl font-black text-[#064E3B] uppercase tracking-tight">
              {editingProduct?.id ? "📝 Cập nhật sản phẩm" : "✨ Thêm sản phẩm mới"}
            </h2>

            <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Tên sản phẩm</label>
                <input
                  required
                  value={editingProduct?.name || ""}
                  onChange={e => setEditingProduct(prev => prev ? ({...prev, name: e.target.value, slug: e.target.value.toLowerCase().replace(/ /g, "-")}) : null)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:border-[#064E3B] focus:ring-1 focus:ring-[#064E3B] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Mã SKU</label>
                <input
                  required
                  value={editingProduct?.sku || ""}
                  onChange={e => setEditingProduct(prev => prev ? ({...prev, sku: e.target.value}) : null)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Đơn vị</label>
                <input
                  required
                  value={editingProduct?.unit || "chai"}
                  onChange={e => setEditingProduct(prev => prev ? ({...prev, unit: e.target.value}) : null)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Tồn kho</label>
                <input
                  required
                  type="number"
                  value={editingProduct?.stock || 0}
                  onChange={e => setEditingProduct(prev => prev ? ({...prev, stock: Number(e.target.value)}) : null)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="col-span-2 pt-4 border-t border-neutral-100 mt-4">
                <h3 className="text-xs font-bold text-[#064E3B] uppercase mb-4">Chi tiết bổ sung (AI Diagnosis)</h3>
                <p className="text-[10px] text-neutral-400 mb-2">Nếu không có thông tin này, hệ thống sẽ để trống khi hiển thị.</p>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1.5">Cây trồng phù hợp</label>
                    <input
                      placeholder="VD: Lúa, Cây ăn trái..."
                      value={editingProduct?.detail?.plantCrops || ""}
                      onChange={e => setEditingProduct(prev => prev ? ({...prev, detail: {...prev.detail, plantCrops: e.target.value}}) : null)}
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1.5">Đối tượng phòng trừ (Phân tách bằng dấu phẩy)</label>
                    <textarea
                      placeholder="VD: Sâu cuốn lá, đạo ôn, rầy nâu..."
                      rows={3}
                      value={editingProduct?.detail?.targetDiseases || ""}
                      onChange={e => setEditingProduct(prev => prev ? ({...prev, detail: {...prev.detail, targetDiseases: e.target.value}}) : null)}
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-2 flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-neutral-500 hover:bg-neutral-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 rounded-xl bg-[#064E3B] text-[#FFD680] text-sm font-bold shadow-lg shadow-[#064E3B]/20 transition-all active:scale-95"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
