"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Power, ChevronLeft, ChevronRight, X, FileText, Info, QrCode, Download } from "lucide-react";
import QRCode from "qrcode";

interface ProductDetail {
  id?: string;
  name?: string;
  plantCrops?: string;
  type?: string;
  ingredients?: string;
  targetDiseases?: string;
  usageInstruction?: string;
  description?: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  price?: number;
  stock: number;
  isActive: boolean;
  unit: string;
  imageUrls?: string[];
  detail?: ProductDetail;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "detail">("basic");

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

  function openCreateModal() {
    setEditingProduct({
      name: "",
      sku: "",
      slug: "",
      unit: "chai",
      price: 0,
      stock: 0,
      isActive: true,
      imageUrls: [],
      detail: {
        plantCrops: "",
        type: "",
        ingredients: "",
        targetDiseases: "",
        usageInstruction: "",
        description: "",
      },
    });
    setActiveTab("basic");
    setIsModalOpen(true);
  }

  function openEditModal(p: Product) {
    setEditingProduct({
      ...p,
      detail: p.detail
        ? { ...p.detail }
        : {
          plantCrops: "",
          type: "",
          ingredients: "",
          targetDiseases: "",
          usageInstruction: "",
          description: "",
        },
    });
    setActiveTab("basic");
    setIsModalOpen(true);
  }

  async function downloadQr(productId: string, productName: string) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const qrUrl = `${baseUrl}/qr/${productId}`;
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 512,
        margin: 2,
        color: { dark: "#064E3B", light: "#FFFFFF" },
      });
      const link = document.createElement("a");
      link.download = `QR_${productName.replace(/[^a-zA-Z0-9_\-]/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("QR generation failed", err);
      alert("Không thể tạo QR code.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#064E3B] uppercase tracking-tight">📦 Quản lý Sản phẩm</h1>
          <p className="text-sm text-neutral-500">Danh mục thuốc bảo vệ thực vật, phân bón & kỹ thuật VFC</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-bold text-[#FFD680] shadow-lg transition hover:opacity-90 active:scale-95"
        >
          <Plus size={18} />
          <span>Thêm sản phẩm</span>
        </button>
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden border border-neutral-200 bg-white shadow-sm rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase text-[10px] tracking-widest">
              <tr>
                <th className="px-6 py-4">Sản phẩm</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Hoạt chất / Chi tiết</th>
                <th className="px-6 py-4 text-center">Tồn kho</th>
                <th className="px-6 py-4 text-center">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-neutral-400">Đang tải...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-neutral-400">Không có sản phẩm nào</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-neutral-800 uppercase text-xs">{p.name}</span>
                        <span className="text-[10px] text-neutral-400">Đơn vị: {p.unit}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-neutral-500">{p.sku}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs max-w-xs">
                        {p.detail?.ingredients ? (
                          <span className="line-clamp-1 font-semibold text-neutral-700">
                            🧪 {p.detail.ingredients}
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400">Chưa cập nhật chi tiết</span>
                        )}
                        {p.detail?.plantCrops && (
                          <span className="line-clamp-1 text-[10px] text-neutral-500">
                            🌾 {p.detail.plantCrops}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${p.stock > 10 ? "bg-blue-50 text-blue-600" : "bg-neutral-100 text-neutral-600"}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleStatus(p.id, p.isActive)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase transition-all ${p.isActive ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"
                          }`}
                      >
                        <Power size={10} />
                        {p.isActive ? "Đang bán" : "Ngưng"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => downloadQr(p.id, p.name)}
                          className="p-1.5 text-neutral-400 hover:text-emerald-600 transition"
                          title="Tải QR Code"
                        >
                          <QrCode size={16} />
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-neutral-400 hover:text-blue-600 transition"
                          title="Chỉnh sửa sản phẩm & chi tiết"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 transition"
                          title="Xóa sản phẩm"
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

      {/* Modal CRUD với TAB CHIA RÕ RÀNG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#064E3B]/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] flex flex-col">
            {/* Modal Header & Close */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-4">
              <h2 className="text-lg font-black text-[#064E3B] uppercase tracking-tight">
                {editingProduct?.id ? "📝 Cập nhật sản phẩm" : "✨ Thêm sản phẩm mới"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 transition">
                <X size={20} />
              </button>
            </div>

            {/* TAB SELECTION BAR */}
            <div className="flex border-b border-neutral-200 mb-5">
              <button
                type="button"
                onClick={() => setActiveTab("basic")}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold transition-all border-b-2 ${activeTab === "basic"
                    ? "border-[#064E3B] text-[#064E3B] bg-emerald-50/50"
                    : "border-transparent text-neutral-400 hover:text-neutral-600"
                  }`}
              >
                <Info size={15} />
                <span>1. Thông tin cần thiết</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("detail")}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold transition-all border-b-2 ${activeTab === "detail"
                    ? "border-[#064E3B] text-[#064E3B] bg-emerald-50/50"
                    : "border-transparent text-neutral-400 hover:text-neutral-600"
                  }`}
              >
                <FileText size={15} />
                <span>2. Thông tin chi tiết kỹ thuật</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 gap-4">
              {/* TAB 1: THÔNG TIN CẦN THIẾT */}
              {activeTab === "basic" && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-150">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Tên sản phẩm *
                    </label>
                    <input
                      required
                      value={editingProduct?.name || ""}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev
                            ? {
                              ...prev,
                              name: e.target.value,
                              slug: e.target.value.toLowerCase().trim().replace(/ /g, "-"),
                            }
                            : null
                        )
                      }
                      placeholder="VD: Michelle 62EC"
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:border-[#064E3B] focus:ring-1 focus:ring-[#064E3B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Mã SKU *
                    </label>
                    <input
                      required
                      value={editingProduct?.sku || ""}
                      onChange={(e) =>
                        setEditingProduct((prev) => (prev ? { ...prev, sku: e.target.value } : null))
                      }
                      placeholder="VD: SKU-MICHELLE-62EC"
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Slug URL
                    </label>
                    <input
                      value={editingProduct?.slug || ""}
                      onChange={(e) =>
                        setEditingProduct((prev) => (prev ? { ...prev, slug: e.target.value } : null))
                      }
                      placeholder="michelle-62ec"
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Giá bán (đ)
                    </label>
                    <input
                      type="number"
                      value={editingProduct?.price || 0}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev ? { ...prev, price: Number(e.target.value) } : null
                        )
                      }
                      placeholder="0"
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Đơn vị tính *
                    </label>
                    <input
                      required
                      value={editingProduct?.unit || "chai"}
                      onChange={(e) =>
                        setEditingProduct((prev) => (prev ? { ...prev, unit: e.target.value } : null))
                      }
                      placeholder="VD: chai, gói, lít..."
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Tồn kho
                    </label>
                    <input
                      type="number"
                      value={editingProduct?.stock || 0}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev ? { ...prev, stock: Number(e.target.value) } : null
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Trạng thái
                    </label>
                    <select
                      value={editingProduct?.isActive ? "true" : "false"}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev ? { ...prev, isActive: e.target.value === "true" } : null
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none bg-white"
                    >
                      <option value="true">Đang kinh doanh</option>
                      <option value="false">Tạm ngưng</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      URL Hình ảnh sản phẩm (Phân tách bằng dấu phẩy)
                    </label>
                    <input
                      value={editingProduct?.imageUrls?.join(", ") || ""}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev
                            ? {
                              ...prev,
                              imageUrls: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            }
                            : null
                        )
                      }
                      placeholder="https://... image1.jpg, https://... image2.jpg"
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: THÔNG TIN CHI TIẾT KỸ THUẬT (product_details) */}
              {activeTab === "detail" && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-150 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      🌿 Cây trồng phù hợp
                    </label>
                    <input
                      placeholder="VD: Lúa (gieo sạ), Bắp, Mía..."
                      value={editingProduct?.detail?.plantCrops || ""}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev
                            ? {
                              ...prev,
                              detail: { ...prev.detail, plantCrops: e.target.value },
                            }
                            : null
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      🏷️ Loại sản phẩm / Chủng loại
                    </label>
                    <input
                      placeholder="VD: Thuốc trừ cỏ tiền nảy mầm..."
                      value={editingProduct?.detail?.type || ""}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev
                            ? {
                              ...prev,
                              detail: { ...prev.detail, type: e.target.value },
                            }
                            : null
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      🧪 Thành phần hoạt chất
                    </label>
                    <input
                      placeholder="VD: Butachlor 620g/lít"
                      value={editingProduct?.detail?.ingredients || ""}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev
                            ? {
                              ...prev,
                              detail: { ...prev.detail, ingredients: e.target.value },
                            }
                            : null
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      🎯 Đối tượng phòng trừ / Cỏ dại & Sâu bệnh
                    </label>
                    <input
                      placeholder="VD: Cỏ lồng vực, cỏ đuôi phụng, cỏ lá rộng..."
                      value={editingProduct?.detail?.targetDiseases || ""}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev
                            ? {
                              ...prev,
                              detail: { ...prev.detail, targetDiseases: e.target.value },
                            }
                            : null
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      📋 Hướng dẫn sử dụng & Liều lượng
                    </label>
                    <textarea
                      rows={3}
                      placeholder="VD: Liều dùng 0.8 - 1.2L/ha. Lượng nước phun 300 - 400L/ha..."
                      value={editingProduct?.detail?.usageInstruction || ""}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev
                            ? {
                              ...prev,
                              detail: { ...prev.detail, usageInstruction: e.target.value },
                            }
                            : null
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none resize-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      📝 Mô tả chi tiết & Quy cách đóng gói (Đặc tính nổi bật, drone...)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="VD: Thuốc trừ cỏ tiền nảy mầm cho lúa. Quy cách: 1.2L, 500ml. Phù hợp phun drone."
                      value={editingProduct?.detail?.description || ""}
                      onChange={(e) =>
                        setEditingProduct((prev) =>
                          prev
                            ? {
                              ...prev,
                              detail: { ...prev.detail, description: e.target.value },
                            }
                            : null
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center justify-between border-t border-neutral-100 pt-4 mt-4">
                <span className="text-[11px] text-neutral-400">
                  {activeTab === "basic" ? "👉 Nhấn Tab 2 để nhập thông tin kỹ thuật" : "✅ Dữ liệu cả 2 tab sẽ được tự động đồng bộ & Upsert vào DB"}
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-100 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-[#064E3B] text-[#FFD680] text-xs font-bold shadow-md shadow-[#064E3B]/20 transition-all active:scale-95 hover:opacity-95"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
