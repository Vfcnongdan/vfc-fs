"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setRole(d.user?.role ?? "FARMER"))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-800">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">Quản lý hệ thống VFC Farmer</p>

      <div className="mt-10">
        <h2 className="text-lg font-bold text-neutral-800 mb-4">Ứng dụng</h2>

        {role === "ADMIN" ? (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            <Link href="/admin/system/users" className="flex flex-col items-center gap-2 group">
              <div className="aspect-square w-full relative rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 overflow-hidden transition group-hover:shadow-md group-active:scale-95">
                <Image
                  src="/assets/images/user-icon.png"
                  alt="Quản lý người dùng"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-xs font-medium text-neutral-600 text-center">Quản lý người dùng</span>
            </Link>
            
            <Link href="/admin/ai-training" className="flex flex-col items-center gap-2 group">
              <div className="aspect-square w-full relative rounded-2xl bg-emerald-50 shadow-sm ring-1 ring-emerald-200 overflow-hidden transition group-hover:shadow-md group-hover:bg-emerald-100 group-active:scale-95 flex items-center justify-center">
                <span className="text-4xl">🧠</span>
              </div>
              <span className="text-xs font-medium text-neutral-600 text-center">AI Training</span>
            </Link>
          </div>
        ) : role === "AGENCY" || role === "SUPER_AGENT" ? (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            <Link href="/agent/inventory" className="flex flex-col items-center gap-2 group">
              <div className="aspect-square w-full relative rounded-2xl bg-emerald-50 shadow-sm ring-1 ring-emerald-200 overflow-hidden transition group-hover:shadow-md group-hover:bg-emerald-100 group-active:scale-95 flex items-center justify-center">
                <span className="text-4xl">📦</span>
              </div>
              <span className="text-xs font-medium text-neutral-600 text-center">Quản lý hàng hóa</span>
            </Link>
          </div>
        ) : role !== null ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-neutral-400">
            <span className="text-5xl mb-4">🔒</span>
            <p className="text-sm font-medium">Bạn chưa có ứng dụng nào được phân quyền.</p>
            <p className="text-xs mt-1">Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
