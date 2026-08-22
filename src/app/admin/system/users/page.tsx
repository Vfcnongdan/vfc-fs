"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Role } from "@prisma/client";
import toast from "react-hot-toast";

interface User {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  profile?: {
    address: string | null;
    notes: string | null;
    cropIds: string[];
  } | null;
}

const ALL_ROLES = [
  "FARMER", "SALE", "AGENCY", "SUPER_AGENT", "MDO", "MDM", "CV_CM", "SE", "ASM", "TSM", "BGD", "ADMIN",
] as const;

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [isProfileSectionOpen, setIsProfileSectionOpen] =
    useState(false);
  const [profileAddress, setProfileAddress] = useState("");
  const [profileNotes, setProfileNotes] = useState("");
  const [allCrops, setAllCrops] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCropIds, setSelectedCropIds] = useState<string[]>([]);
  const [loadingCropsForProfile, setLoadingCropsForProfile] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page khi filter thay đổi
  useEffect(() => { setPage(1); }, [roleFilter, activeFilter]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: debouncedSearch,
        page: String(page),
        ...(roleFilter && { role: roleFilter }),
        ...(activeFilter && { isActive: activeFilter }),
      });
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, roleFilter, activeFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!isEditModalOpen || !selectedUser) return;

    setIsProfileSectionOpen(false); // collapsed by default
    setProfileAddress(selectedUser.profile?.address ?? "");
    setProfileNotes(selectedUser.profile?.notes ?? "");
    setSelectedCropIds(selectedUser.profile?.cropIds ?? []);

    setLoadingCropsForProfile(true);
    fetch("/api/crops")
      .then((res) => res.json())
      .then((data) => {
        setAllCrops(
          (data ?? []).map((c: any) => ({ id: c.id as string, name: c.name as string })),
        );
      })
      .catch((err) => {
        console.error("Failed to load crops for profile:", err);
        setAllCrops([]);
      })
      .finally(() => setLoadingCropsForProfile(false));
  }, [isEditModalOpen, selectedUser?.id]);

  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) {
        setUsers(
          users.map((u) =>
            u.id === user.id ? { ...u, isActive: !u.isActive } : u,
          ),
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa người dùng này?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== id));
        setTotal((prev) => prev - 1);
      } else {
        const data = await res.json();
        toast.error(data.error || "Xóa thất bại");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = {
      name: formData.get("name") as string,
      role: formData.get("role") as Role,
    };

    const isEdit = !!selectedUser;
    if (!isEdit) {
      data.phone = formData.get("phone") as string;
    }

    if (isEdit && isProfileSectionOpen) {
      data.address = profileAddress.trim().length > 0 ? profileAddress.trim() : null;
      data.notes = profileNotes.trim().length > 0 ? profileNotes.trim() : null;
      data.cropIds = selectedCropIds;
    }

    try {
      const url = isEdit
        ? `/api/admin/users/${selectedUser.id}`
        : "/api/admin/users";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        if (isEdit) {
          setUsers(
            users.map((u) =>
              u.id === selectedUser.id ? { ...u, ...data } : u,
            ),
          );
        } else {
          setUsers([result, ...users]);
          setTotal((prev) => prev + 1);
        }
        setIsEditModalOpen(false);
        setSelectedUser(null);
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Thao tác thất bại");
      }
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/system"
            className="text-neutral-500 hover:text-neutral-800 transition text-sm"
          >
            Quản lý hệ thống
          </Link>
          <span className="text-neutral-300">/</span>
          <h1 className="text-xl font-bold text-neutral-800">
            Quản lý người dùng
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          {/* Row 1: Search + Add button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="Tìm theo tên hoặc số điện thoại..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition shadow-sm text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Role filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm bg-white shadow-sm"
            >
              <option value="">Tất cả Role</option>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* Active filter */}
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm bg-white shadow-sm"
            >
              <option value="">Mọi trạng thái</option>
              <option value="true">✅ Hoạt động</option>
              <option value="false">🚫 Bị chặn</option>
            </select>

            {/* Clear filters */}
            {(roleFilter || activeFilter || search) && (
              <button
                onClick={() => { setSearch(""); setRoleFilter(""); setActiveFilter(""); }}
                className="px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 transition whitespace-nowrap"
                title="Xóa bộ lọc"
              >
                ✕ Xóa lọc
              </button>
            )}

            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-neutral-500 whitespace-nowrap">
                <span className="font-bold text-neutral-800">{total}</span> người dùng
              </span>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setIsEditModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition shadow-lg shadow-green-600/20 text-sm whitespace-nowrap"
              >
                <span>+</span> Thêm người dùng
              </button>
            </div>
          </div>

          {/* Active filter badges */}
          {(roleFilter || activeFilter) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Bộ lọc:</span>
              {roleFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-bold">
                  Role: {roleFilter}
                  <button onClick={() => setRoleFilter("")} className="ml-1 hover:text-green-900">×</button>
                </span>
              )}
              {activeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
                  {activeFilter === "true" ? "✅ Hoạt động" : "🚫 Bị chặn"}
                  <button onClick={() => setActiveFilter("")} className="ml-1 hover:text-blue-900">×</button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User List Area - Scrollable */}
      <div className="flex-1 overflow-hidden bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-neutral-50 z-10 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Người dùng
                </th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-neutral-100 rounded w-32"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-neutral-100 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-neutral-100 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-neutral-100 rounded w-24 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : users.length > 0 ? (
                users.map((user) => {
                  if (!user) return null;
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-neutral-50 transition"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-neutral-800">
                            {user.name || "Chưa đặt tên"}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {user.phone}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                            user.role === "ADMIN"
                              ? "bg-purple-100 text-purple-700"
                              : user.role === "SALE"
                                ? "bg-blue-100 text-blue-700"
                                : user.role === "AGENCY"
                                  ? "bg-amber-100 text-amber-700"
                                  : user.role === "SUPER_AGENT"
                                    ? "bg-cyan-100 text-cyan-700"
                                    : user.role === "MDO"
                                      ? "bg-indigo-100 text-indigo-700"
                                    : user.role === "MDM"
                                      ? "bg-indigo-100 text-indigo-600"
                                    : user.role === "CV_CM"
                                      ? "bg-violet-100 text-violet-700"
                                    : user.role === "SE"
                                      ? "bg-rose-100 text-rose-700"
                                    : user.role === "ASM"
                                      ? "bg-rose-100 text-rose-600"
                                    : user.role === "TSM"
                                      ? "bg-pink-100 text-pink-700"
                                      : user.role === "BGD"
                                        ? "bg-slate-800 text-white"
                                        : "bg-green-100 text-green-700"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition ${
                            user.isActive
                              ? "bg-green-50 text-green-700 hover:bg-green-100"
                              : "bg-red-50 text-red-700 hover:bg-red-100"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`}
                          ></span>
                          {user.isActive ? "Hoạt động" : "Bị chặn"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-blue-600 transition"
                          title="Chi tiết"
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-amber-600 transition"
                          title="Sửa"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 transition"
                          title="Xóa"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-neutral-400 italic"
                  >
                    Không tìm thấy người dùng nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between bg-white shrink-0 gap-4">
          <p className="text-xs text-neutral-400">
            Trang <span className="font-bold text-neutral-700">{page}</span> / <span className="font-bold text-neutral-700">{Math.max(totalPages, 1)}</span>
            {" "}· <span className="font-bold text-neutral-700">{total}</span> kết quả
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(1)}
              className="px-2 py-1.5 rounded-lg border border-neutral-200 text-xs disabled:opacity-40 hover:bg-neutral-50 transition font-medium"
              title="Trang đầu"
            >
              «
            </button>
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs disabled:opacity-40 hover:bg-neutral-50 transition font-medium"
            >
              ← Trước
            </button>

            {/* Page number buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                    p === page
                      ? "bg-green-600 text-white border border-green-600 shadow-sm"
                      : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs disabled:opacity-40 hover:bg-neutral-50 transition font-medium"
            >
              Tiếp →
            </button>
            <button
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage(totalPages)}
              className="px-2 py-1.5 rounded-lg border border-neutral-200 text-xs disabled:opacity-40 hover:bg-neutral-50 transition font-medium"
              title="Trang cuối"
            >
              »
            </button>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-bold text-neutral-800">
                {selectedUser ? "Chỉnh sửa người dùng" : "Thêm người dùng mới"}
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitUser} className="p-6 space-y-4">
              {!selectedUser && (
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                    Số điện thoại
                  </label>
                  <input
                    name="phone"
                    required
                    placeholder="Ví dụ: 0912345678"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                  Tên hiển thị
                </label>
                <input
                  name="name"
                  defaultValue={selectedUser?.name || ""}
                  placeholder="Nhập tên người dùng"
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                  Vai trò (Role)
                </label>
                <select
                  name="role"
                  defaultValue={selectedUser?.role || "FARMER"}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                >
                  <option value="FARMER">FARMER</option>
                  <option value="SALE">SALE (Nhân viên kinh doanh)</option>
                  <option value="AGENCY">AGENCY (Đại lý)</option>
                  <option value="SUPER_AGENT">SUPER_AGENT (Tổng đại lý)</option>
                  <option value="MDO">MDO (Quảng bá sản phẩm)</option>
                  <option value="MDM">MDM (Quản lý địa bàn)</option>
                  <option value="CV_CM">CV_CM (Chuyên viên chăm sóc)</option>
                  <option value="SE">SE (Kỹ sư khu vực)</option>
                  <option value="ASM">ASM (Quản lý khu vực kinh doanh)</option>
                  <option value="TSM">TSM (Quản lý kinh doanh lãnh thổ)</option>
                  <option value="BGD">BGD (Ban giám đốc)</option>
                  <option value="ADMIN">ADMIN (Quản trị viên)</option>
                </select>
              </div>

              {selectedUser && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsProfileSectionOpen((v) => !v)}
                    className="w-full text-left px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-sm font-bold text-neutral-700"
                  >
                    {isProfileSectionOpen
                      ? "▾ Ẩn thông tin Profile"
                      : "▸ Hiển thị thông tin Profile"}
                  </button>

                  {isProfileSectionOpen && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                          Địa chỉ
                        </label>
                        <input
                          value={profileAddress}
                          onChange={(e) => setProfileAddress(e.target.value)}
                          placeholder="Địa chỉ của người dùng"
                          className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                          Ghi chú
                        </label>
                        <textarea
                          value={profileNotes}
                          onChange={(e) => setProfileNotes(e.target.value)}
                          placeholder="Ghi chú (tuỳ chọn)"
                          rows={3}
                          className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                          Cây trồng của tôi
                        </label>
                        {loadingCropsForProfile ? (
                          <p className="text-xs text-neutral-500 italic">
                            Đang tải danh sách cây trồng...
                          </p>
                        ) : allCrops.length === 0 ? (
                          <p className="text-xs text-neutral-500 italic">
                            Không có cây trồng nào.
                          </p>
                        ) : (
                          <div className="max-h-36 overflow-y-auto rounded-xl border border-neutral-200 bg-white/60 p-2">
                            <div className="grid grid-cols-1 gap-2">
                              {allCrops.map((c) => {
                                const checked =
                                  selectedCropIds.includes(c.id);
                                return (
                                  <label
                                    key={c.id}
                                    className="flex items-center gap-3 text-sm cursor-pointer select-none"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        setSelectedCropIds((prev) =>
                                          prev.includes(c.id)
                                            ? prev.filter((x) => x !== c.id)
                                            : [...prev, c.id],
                                        )
                                      }
                                    />
                                    <span className="text-neutral-700">
                                      {c.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2 text-sm font-bold text-neutral-500 hover:bg-neutral-50 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition shadow-lg shadow-green-600/20"
                >
                  {selectedUser ? "Lưu thay đổi" : "Tạo người dùng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
              <h2 className="font-bold text-neutral-800">
                Chi tiết người dùng
              </h2>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-2xl">
                  {selectedUser.role === "ADMIN"
                    ? "👑"
                    : selectedUser.role === "BGD"
                      ? "🏢"
                      : selectedUser.role === "SALE"
                        ? "💼"
                        : selectedUser.role === "AGENCY"
                          ? "🏪"
                          : selectedUser.role === "SUPER_AGENT"
                            ? "🚀"
                          : selectedUser.role === "MDO"
                            ? "📢"
                            : selectedUser.role === "MDM"
                              ? "📊"
                              : selectedUser.role === "CV_CM"
                                ? "🎯"
                                : selectedUser.role === "SE"
                                  ? "📐"
                                  : selectedUser.role === "ASM"
                                    ? "🗂️"
                                    : selectedUser.role === "TSM"
                                      ? "📋"
                                      : "👩‍🌾"}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-800">
                    {selectedUser.name || "Chưa đặt tên"}
                  </h3>
                  <p className="text-sm text-neutral-500">
                    {selectedUser.phone}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <div>
                  <span className="block text-xs font-bold text-neutral-400 uppercase">
                    ID
                  </span>
                  <span className="font-mono text-xs">{selectedUser.id}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-neutral-400 uppercase">
                    Ngày tạo
                  </span>
                  <span>
                    {new Date(selectedUser.createdAt).toLocaleDateString(
                      "vi-VN",
                    )}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-neutral-400 uppercase">
                    Vai trò
                  </span>
                  <span className="font-bold text-green-700">
                    {selectedUser.role}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-neutral-400 uppercase">
                    Trạng thái
                  </span>
                  <span
                    className={
                      selectedUser.isActive
                        ? "text-green-600 font-bold"
                        : "text-red-600 font-bold"
                    }
                  >
                    {selectedUser.isActive ? "Đang hoạt động" : "Đã bị chặn"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="w-full py-3 text-sm font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
