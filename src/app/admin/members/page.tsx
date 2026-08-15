"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ───── Tab config ───── */
type TabKey = "agencies" | "farmers" | "mdo" | "se";

interface TabConfig {
  key: TabKey;
  label: string;
  icon: string;
  columns: { key: string; label: string; width?: string }[];
  formFields: { key: string; label: string; required?: boolean; type?: string; placeholder?: string }[];
}

const TABS: TabConfig[] = [
  {
    key: "agencies",
    label: "Đại lý",
    icon: "🏪",
    columns: [
      { key: "code", label: "Mã", width: "w-24" },
      { key: "name", label: "Tên đại lý" },
      { key: "phone", label: "SĐT", width: "w-32" },
      { key: "area", label: "Khu vực", width: "w-28" },
      { key: "address", label: "Địa chỉ" },
    ],
    formFields: [
      { key: "code", label: "Mã đại lý", required: true, placeholder: "VD: DL001" },
      { key: "name", label: "Tên đại lý", required: true, placeholder: "Tên đại lý" },
      { key: "phone", label: "Số điện thoại", placeholder: "0901234567" },
      { key: "taxCode", label: "Mã số thuế", placeholder: "Mã số thuế" },
      { key: "salesman", label: "Nhân viên bán hàng", placeholder: "Tên nhân viên" },
      { key: "area", label: "Khu vực", placeholder: "Khu vực" },
      { key: "address", label: "Địa chỉ", placeholder: "Địa chỉ chi tiết" },
      { key: "wardProvince", label: "Phường/Tỉnh", placeholder: "Phường, Tỉnh" },
      { key: "latitude", label: "Vĩ độ", type: "number", placeholder: "0" },
      { key: "longitude", label: "Kinh độ", type: "number", placeholder: "0" },
    ],
  },
  {
    key: "farmers",
    label: "Nông dân",
    icon: "🌾",
    columns: [
      { key: "name", label: "Tên" },
      { key: "phone", label: "SĐT", width: "w-32" },
      { key: "province", label: "Tỉnh", width: "w-28" },
      { key: "crop", label: "Cây trồng", width: "w-28" },
      { key: "agencyCode", label: "Mã đại lý", width: "w-24" },
    ],
    formFields: [
      { key: "name", label: "Họ và tên", required: true, placeholder: "Nguyễn Văn A" },
      { key: "phone", label: "Số điện thoại", required: true, placeholder: "0901234567" },
      { key: "ward", label: "Xã/Phường", placeholder: "Xã/Phường" },
      { key: "province", label: "Tỉnh/TP", placeholder: "Tỉnh/Thành phố" },
      { key: "crop", label: "Cây trồng", placeholder: "Lúa, Bắp..." },
      { key: "area", label: "Diện tích (ha)", type: "number", placeholder: "0" },
      { key: "agencyCode", label: "Mã đại lý", placeholder: "DL001" },
      { key: "mdo", label: "MDO phụ trách", placeholder: "Tên MDO" },
      { key: "se", label: "SE phụ trách", placeholder: "Tên SE" },
    ],
  },
  {
    key: "mdo",
    label: "MDO",
    icon: "👔",
    columns: [
      { key: "employeeCode", label: "Mã NV", width: "w-28" },
      { key: "name", label: "Họ tên" },
      { key: "phone", label: "SĐT", width: "w-32" },
      { key: "region", label: "Vùng", width: "w-28" },
      { key: "check", label: "Check", width: "w-20" },
    ],
    formFields: [
      { key: "name", label: "Họ và tên", required: true, placeholder: "Nguyễn Văn B" },
      { key: "employeeCode", label: "Mã nhân viên", required: true, placeholder: "MDO001" },
      { key: "phone", label: "Số điện thoại", required: true, placeholder: "0901234567" },
      { key: "region", label: "Vùng", placeholder: "Miền Nam" },
      { key: "check", label: "Check", placeholder: "OK" },
    ],
  },
  {
    key: "se",
    label: "SE",
    icon: "🔬",
    columns: [
      { key: "employeeCode", label: "Mã NV", width: "w-28" },
      { key: "name", label: "Họ tên" },
      { key: "phone", label: "SĐT", width: "w-32" },
      { key: "region", label: "Vùng", width: "w-24" },
      { key: "area", label: "Khu vực", width: "w-24" },
    ],
    formFields: [
      { key: "name", label: "Họ và tên", required: true, placeholder: "Trần Văn C" },
      { key: "employeeCode", label: "Mã nhân viên", required: true, placeholder: "SE001" },
      { key: "phone", label: "Số điện thoại", required: true, placeholder: "0901234567" },
      { key: "region", label: "Vùng", placeholder: "Miền Tây" },
      { key: "area", label: "Khu vực", placeholder: "Cần Thơ" },
      { key: "location", label: "Địa điểm", placeholder: "Chi tiết vị trí" },
      { key: "email", label: "Email", type: "email", placeholder: "email@example.com" },
    ],
  },
];

/* ───── Debounce hook ───── */
function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ───── Main component ───── */
export default function MembersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("agencies");
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tabConfig = TABS.find((t) => t.key === activeTab)!;

  /* ─── Fetch ─── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tab: activeTab,
        q: debouncedSearch,
        page: page.toString(),
      });
      const res = await fetch(`/api/admin/members?${params}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page & search on tab change
  useEffect(() => {
    setPage(1);
    setSearch("");
    setError(null);
    setSuccessMsg(null);
  }, [activeTab]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  /* ─── Create ─── */
  const openCreate = () => {
    setModalMode("create");
    setFormData({});
    setEditingId(null);
    setError(null);
    setModalOpen(true);
  };

  /* ─── Edit ─── */
  const openEdit = (item: any) => {
    setModalMode("edit");
    const data: Record<string, string> = {};
    tabConfig.formFields.forEach((f) => {
      data[f.key] = item[f.key] != null ? String(item[f.key]) : "";
    });
    setFormData(data);
    setEditingId(item.id);
    setError(null);
    setModalOpen(true);
  };

  /* ─── Submit ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url =
        modalMode === "create"
          ? "/api/admin/members"
          : `/api/admin/members/${editingId}`;
      const method = modalMode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: activeTab, data: formData }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Thao tác thất bại");
        return;
      }

      setModalOpen(false);
      setSuccessMsg(modalMode === "create" ? "Thêm mới thành công!" : "Cập nhật thành công!");
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchData();
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Delete ─── */
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/members/${deleteConfirm.id}?tab=${activeTab}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Xóa thất bại");
      } else {
        setSuccessMsg("Đã xóa thành công!");
        setTimeout(() => setSuccessMsg(null), 3000);
        fetchData();
      }
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  /* ─── Pagination helpers ─── */
  const pageNumbers = (() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-3">
            <span className="p-2.5 bg-blue-50 rounded-2xl text-2xl">👥</span>
            Quản lý Thành viên
          </h1>
          <p className="mt-1 text-sm text-neutral-500 font-medium">
            Quản lý danh sách Đại lý, Nông dân, MDO và SE trong hệ thống.
          </p>
        </div>
      </div>

      {/* Success / Error alerts */}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <span>✅</span>
          {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-emerald-600 font-bold">✕</button>
        </div>
      )}
      {error && !modalOpen && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold flex items-center gap-2">
          <span>⚠️</span>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-neutral-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.key
              ? "border-[#064E3B] text-[#064E3B] bg-[#064E3B]/5 rounded-t-xl"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Search + Add button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Tìm kiếm ${tabConfig.label}...`}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-[#064E3B] focus:border-[#064E3B] outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
          <div className="mt-1.5 ml-1 text-[11px] text-neutral-400 font-medium">
            Có thể tìm theo: <span className="text-neutral-500">{
              activeTab === "agencies" ? "Tên, SĐT, Mã đại lý, Khu vực, Địa chỉ, Phường/Tỉnh" :
                activeTab === "farmers" ? "Tên, SĐT, Tỉnh, Mã đại lý" :
                  activeTab === "mdo" ? "Tên, SĐT, Mã NV, Vùng" :
                    "Tên, SĐT, Mã NV, Vùng"
            }</span>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center self-start gap-2 px-5 py-2.5 bg-[#064E3B] text-white text-sm font-bold rounded-xl hover:bg-[#064E3B]/90 transition-all shadow-sm whitespace-nowrap"
        >
          <span>＋</span>
          <span>Thêm {tabConfig.label}</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-neutral-500 uppercase tracking-wider w-12">
                  #
                </th>
                {tabConfig.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left text-[11px] font-bold text-neutral-500 uppercase tracking-wider ${col.width || ""}`}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[11px] font-bold text-neutral-500 uppercase tracking-wider w-28">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={tabConfig.columns.length + 2} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-neutral-400">
                      <span className="w-6 h-6 border-2 border-neutral-300 border-t-[#064E3B] rounded-full animate-spin" />
                      <span className="text-sm font-medium">Đang tải...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={tabConfig.columns.length + 2} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-neutral-400">
                      <span className="text-4xl">📭</span>
                      <span className="text-sm font-medium">
                        {debouncedSearch ? `Không tìm thấy kết quả cho "${debouncedSearch}"` : "Chưa có dữ liệu"}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="px-4 py-3 text-xs text-neutral-400 font-mono">
                      {(page - 1) * 15 + idx + 1}
                    </td>
                    {tabConfig.columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-neutral-700 font-medium truncate max-w-[200px]">
                        {item[col.key] ?? <span className="text-neutral-300">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          title="Sửa"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() =>
                            setDeleteConfirm({ id: item.id, name: item.name || item.code || item.phone })
                          }
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-all"
                          title="Xóa"
                        >
                          🗑️
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50/50">
            <span className="text-xs text-neutral-500 font-medium">
              Tổng <strong className="text-neutral-800">{total}</strong> bản ghi
              {" · "}Trang {page}/{totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ‹
              </button>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition ${p === page
                    ? "bg-[#064E3B] text-white border-[#064E3B]"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                    }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Create/Edit Modal ─── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-neutral-200">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-neutral-100 rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <span>{tabConfig.icon}</span>
                  {modalMode === "create" ? `Thêm ${tabConfig.label} mới` : `Sửa ${tabConfig.label}`}
                </h3>
                <button
                  onClick={() => !submitting && setModalOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold flex items-center gap-2">
                  <span>⚠️</span>
                  {error}
                </div>
              )}

              {tabConfig.formFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    type={field.type || "text"}
                    required={field.required}
                    placeholder={field.placeholder}
                    value={formData[field.key] || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-[#064E3B] focus:border-[#064E3B] outline-none transition"
                  />
                </div>
              ))}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-bold text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#064E3B] text-white text-sm font-bold rounded-xl hover:bg-[#064E3B]/90 transition-all disabled:opacity-50 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>{modalMode === "create" ? "Thêm mới" : "Cập nhật"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-neutral-200">
            <div className="flex flex-col items-center text-center gap-3">
              <span className="text-4xl">🗑️</span>
              <h3 className="text-lg font-bold text-neutral-900">Xác nhận xóa?</h3>
              <p className="text-sm text-neutral-500">
                Bạn có chắc muốn xóa <strong className="text-neutral-800">{deleteConfirm.name}</strong>?
                <br />
                Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-5 py-2.5 text-sm font-bold text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 shadow-sm"
              >
                {deleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <span>Xóa</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
