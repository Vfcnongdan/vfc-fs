"use client";

import { Suspense, useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  Search,
  Calendar,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpDown,
  Filter,
} from "lucide-react";

type B2cOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  buyer: { phone: string; name: string | null };
  seller: { name: string | null; agency?: { id?: string; name: string; code?: string } | null };
  items: Array<{
    quantity: number;
    product: { name: string };
  }>;
};

const STATUS_MAP: Record<string, { label: string; color: string; activeColor: string }> = {
  ALL: {
    label: "Tất cả",
    color: "bg-neutral-100 text-neutral-700 border-neutral-200",
    activeColor: "bg-neutral-900 text-white border-neutral-900",
  },
  PENDING: {
    label: "Chờ duyệt",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    activeColor: "bg-amber-500 text-white border-amber-600",
  },
  CONFIRMED: {
    label: "Đã xác nhận",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    activeColor: "bg-blue-600 text-white border-blue-700",
  },
  SHIPPING: {
    label: "Đang giao",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    activeColor: "bg-purple-600 text-white border-purple-700",
  },
  DELIVERED: {
    label: "Hoàn tất",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    activeColor: "bg-emerald-600 text-white border-emerald-700",
  },
  CANCELLED: {
    label: "Đã hủy",
    color: "bg-red-50 text-red-700 border-red-200",
    activeColor: "bg-red-600 text-white border-red-700",
  },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function toIsoDateString(d: Date) {
  return d.toISOString().split("T")[0];
}

function AdminOrdersContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<B2cOrder[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(() => searchParams.get("orderId"));
  const [userRole, setUserRole] = useState<string | null>(null);

  // Filter states
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchDebounced, setSearchDebounced] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("ALL");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState<number>(1);
  const limit = 20;

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchDebounced(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Initial user check
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((userData) => {
        setUserRole(userData.user?.role ?? null);
      })
      .catch((err) => console.error("Error fetching user", err));
  }, []);

  // Fetch orders when filters change
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (selectedStatus && selectedStatus !== "ALL") {
        params.set("status", selectedStatus);
      }
      if (searchDebounced) {
        params.set("search", searchDebounced);
      }
      if (startDate) {
        params.set("startDate", startDate);
      }
      if (endDate) {
        params.set("endDate", endDate);
      }
      if (sort) {
        params.set("sort", sort);
      }

      const res = await fetch(`/api/b2c/orders?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setOrders(data.data ?? []);
        setTotal(data.total ?? 0);
        if (data.statusCounts) {
          setStatusCounts(data.statusCounts);
        }
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedStatus, searchDebounced, startDate, endDate, sort]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto expand and scroll to orderId if present in URL
  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId) return;

    const timeoutId = window.setTimeout(() => {
      setExpandedId(orderId);
      window.setTimeout(() => {
        document.getElementById(`order-${orderId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  // Quick date presets
  const applyDatePreset = (preset: "ALL" | "TODAY" | "WEEK" | "MONTH") => {
    setDatePreset(preset);
    setPage(1);

    const now = new Date();
    if (preset === "ALL") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "TODAY") {
      const today = toIsoDateString(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "WEEK") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      setStartDate(toIsoDateString(weekAgo));
      setEndDate(toIsoDateString(now));
    } else if (preset === "MONTH") {
      const monthAgo = new Date();
      monthAgo.setDate(now.getDate() - 30);
      setStartDate(toIsoDateString(monthAgo));
      setEndDate(toIsoDateString(now));
    }
  };

  // Reset all filters
  const resetAllFilters = () => {
    setSelectedStatus("ALL");
    setSearchInput("");
    setSearchDebounced("");
    setStartDate("");
    setEndDate("");
    setDatePreset("ALL");
    setSort("newest");
    setPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      selectedStatus !== "ALL" ||
      searchInput.trim() !== "" ||
      startDate !== "" ||
      endDate !== "" ||
      sort !== "newest"
    );
  }, [selectedStatus, searchInput, startDate, endDate, sort]);

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/b2c/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      fetchOrders();
    }
  }

  const canEdit = userRole === "AGENCY" || userRole === "SUPER_AGENT" || userRole === "ADMIN";
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-vfc-mint border border-vfc-green/20">
              <ShoppingCart size={24} className="text-vfc-green" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-vfc-green uppercase tracking-tight">
                Quản lý đơn hàng
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500">
                Theo dõi và xử lý danh sách đơn hàng B2C từ nông dân
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-red-600 active:scale-95 shadow-2xs cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
          <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-bold text-neutral-600 shadow-2xs">
            Tổng: <span className="text-vfc-green font-extrabold">{total}</span> đơn
          </div>
        </div>
      </div>

      {/* 1. Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {Object.entries(STATUS_MAP).map(([key, item]) => {
          const isSelected = selectedStatus === key;
          const count = statusCounts[key] ?? (key === "ALL" ? total : 0);
          return (
            <button
              key={key}
              onClick={() => {
                setSelectedStatus(key);
                setPage(1);
              }}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? `${item.activeColor} shadow-xs scale-[1.02]`
                  : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  isSelected ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Filter Bar */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-xs flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-8">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Tìm mã đơn, tên/SĐT nông dân, đại lý, sản phẩm..."
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-9 pr-9 py-2 text-xs sm:text-sm text-neutral-800 placeholder-neutral-400 outline-none transition focus:border-vfc-green focus:bg-white focus:ring-2 focus:ring-vfc-green/15"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Order */}
          <div className="relative md:col-span-4">
            <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as "newest" | "oldest");
                setPage(1);
              }}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-9 pr-8 py-2 text-xs sm:text-sm text-neutral-700 outline-none transition focus:border-vfc-green focus:bg-white focus:ring-2 focus:ring-vfc-green/15 cursor-pointer"
            >
              <option value="newest">Mới nhất trước</option>
              <option value="oldest">Cũ nhất trước</option>
            </select>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-100">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 mr-1">
              <Calendar size={14} className="text-neutral-400" />
              <span>Thời gian:</span>
            </div>

            {/* Quick date presets */}
            <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-xs font-semibold">
              {[
                { id: "ALL", label: "Tất cả" },
                { id: "TODAY", label: "Hôm nay" },
                { id: "WEEK", label: "7 ngày qua" },
                { id: "MONTH", label: "30 ngày" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyDatePreset(p.id as any)}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    datePreset === p.id
                      ? "bg-white text-neutral-900 shadow-2xs font-bold"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Dates */}
            <div className="flex items-center gap-1 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("CUSTOM");
                  setPage(1);
                }}
                className="rounded-lg border border-neutral-200 px-2.5 py-1 text-neutral-700 outline-none focus:border-vfc-green bg-white text-xs cursor-pointer"
              />
              <span className="text-neutral-400 font-medium">đến</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("CUSTOM");
                  setPage(1);
                }}
                className="rounded-lg border border-neutral-200 px-2.5 py-1 text-neutral-700 outline-none focus:border-vfc-green bg-white text-xs cursor-pointer"
              />
            </div>
          </div>

          {/* Result summary indicator */}
          <div className="text-xs text-neutral-500 font-medium">
            Tìm thấy <span className="font-bold text-neutral-800">{total}</span> đơn hàng
          </div>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-neutral-100 border border-neutral-200/50" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-white py-16 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-50 text-neutral-400">
            {hasActiveFilters ? <Filter size={28} /> : <ShoppingCart size={28} />}
          </div>
          <p className="text-sm font-bold text-neutral-700">
            {hasActiveFilters ? "Không tìm thấy đơn hàng nào phù hợp" : "Chưa có đơn hàng nào"}
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            {hasActiveFilters
              ? "Hãy thử thay đổi từ khóa tìm kiếm, trạng thái đơn hoặc khoảng thời gian lọc."
              : "Danh sách đơn hàng B2C sẽ xuất hiện tại đây khi nông dân đặt hàng."}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-vfc-green px-4 py-2 text-xs font-bold text-white transition hover:bg-vfc-dark-green active:scale-95 shadow-xs cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {orders.map((order) => {
            const status = STATUS_MAP[order.status] || {
              label: order.status,
              color: "bg-neutral-100 text-neutral-600 border-neutral-200",
              activeColor: "bg-neutral-800 text-white border-neutral-800",
            };
            const isExpanded = expandedId === order.id;
            const mainItem = order.items[0]?.product?.name;
            const extraCount = order.items.length - 1;
            const isHighlighted = searchParams.get("orderId") === order.id;

            return (
              <div
                key={order.id}
                id={`order-${order.id}`}
                className={`group rounded-2xl border bg-white p-4 transition-all shadow-2xs ${
                  isHighlighted
                    ? "border-vfc-green shadow-md ring-2 ring-vfc-green/20"
                    : "border-neutral-200 hover:border-neutral-300 hover:shadow-xs"
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    className="mt-1 rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
                    aria-label="Toggle order details"
                  >
                    <svg
                      className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-extrabold text-neutral-900 tracking-wide">
                          #{order.orderNumber.slice(-8).toUpperCase()}
                        </span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${status.color}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="text-[11px] font-medium text-neutral-400">
                        {formatDate(order.createdAt)} • {formatTime(order.createdAt)}
                      </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs bg-neutral-50/60 rounded-xl p-2.5 border border-neutral-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          Nông dân
                        </span>
                        <span className="font-bold text-neutral-800">{order.buyer.name ?? "Chưa đặt tên"}</span>
                        <span className="text-neutral-500 font-mono text-[11px]">{order.buyer.phone}</span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          Đại lý bán lẻ
                        </span>
                        <span className="font-bold text-neutral-800">
                          {order.seller.agency?.name ?? order.seller.name ?? "—"}
                        </span>
                        {order.seller.agency?.code && (
                          <span className="text-neutral-400 font-mono text-[11px]">
                            Mã: {order.seller.agency.code}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:col-span-2 lg:col-span-1">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          Sản phẩm ({order.items.length})
                        </span>
                        <span className="font-medium text-neutral-700 truncate">
                          {mainItem ?? "Không có sản phẩm"}
                          {extraCount > 0 && (
                            <span className="text-neutral-500 font-semibold"> +{extraCount} loại khác</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 border-t border-neutral-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        Danh sách sản phẩm trong đơn
                      </p>
                      <span className="text-xs text-neutral-400">
                        {order.items.length} mặt hàng
                      </span>
                    </div>

                    <div className="mb-4 divide-y divide-neutral-100 rounded-xl border border-neutral-100 bg-neutral-50/40 p-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 px-2 text-xs sm:text-sm">
                          <span className="text-neutral-800 font-medium">{item.product?.name}</span>
                          <span className="tabular-nums text-neutral-900 font-extrabold bg-white border border-neutral-200 px-2 py-0.5 rounded-md text-xs">
                            ×{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                      <div className="text-xs text-neutral-400">
                        Thời gian tạo: <span className="text-neutral-600 font-medium">{formatDate(order.createdAt)} lúc {formatTime(order.createdAt)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 font-medium">Trạng thái:</span>
                        {canEdit ? (
                          <select
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-800 outline-none transition focus:border-vfc-green focus:ring-2 focus:ring-vfc-green/15 cursor-pointer shadow-2xs"
                            value={order.status}
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                          >
                            {Object.entries(STATUS_MAP)
                              .filter(([val]) => val !== "ALL")
                              .map(([value, { label }]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <div className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${status.color}`}>
                            {status.label}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* 3. Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border border-neutral-200/80 bg-white px-4 py-3 rounded-2xl shadow-xs mt-2">
              <div className="text-xs text-neutral-500">
                Hiển thị <span className="font-bold text-neutral-800">{(page - 1) * limit + 1}</span> -{" "}
                <span className="font-bold text-neutral-800">{Math.min(page * limit, total)}</span> trong{" "}
                <span className="font-bold text-neutral-800">{total}</span> đơn
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span>Trước</span>
                </button>

                <div className="px-2 text-xs font-bold text-neutral-700">
                  {page} / {totalPages}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <span>Sau</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl bg-neutral-100" />}>
      <AdminOrdersContent />
    </Suspense>
  );
}
