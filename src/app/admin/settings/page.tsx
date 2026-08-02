"use client";

import { useState, useEffect } from "react";

interface ZaloStatus {
  configured: boolean;
  enabled: boolean;
  expiresAt: string | null;
  accessTokenMasked?: string;
  refreshTokenMasked?: string;
  isExpiringSoon?: boolean;
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<"zalo" | "general">("zalo");
  const [status, setStatus] = useState<ZaloStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [authCode, setAuthCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/settings/zalo");
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus(data.status);
      } else {
        setMessage({ type: "error", text: data.error || "Không thể tải trạng thái Zalo token" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Lỗi kết nối khi tải cấu hình Zalo" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleActivateZalo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authCode.trim()) {
      setMessage({ type: "error", text: "Vui lòng nhập Authorization Code" });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);
      const res = await fetch("/api/admin/settings/zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: authCode.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: "success", text: data.message || "Kích hoạt chứng thực Zalo thành công!" });
        setAuthCode("");
        await fetchStatus();
      } else {
        setMessage({ type: "error", text: data.error || data.message || "Kích hoạt thất bại" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Lỗi kết nối tới máy chủ khi kích hoạt Zalo" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnable = async (newEnabledState: boolean) => {
    try {
      setToggling(true);
      setMessage(null);
      const res = await fetch("/api/admin/settings/zalo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabledState }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: "success", text: data.message });
        setStatus((prev) => (prev ? { ...prev, enabled: newEnabledState } : prev));
      } else {
        setMessage({ type: "error", text: data.error || "Không thể đổi trạng thái chứng thực Zalo" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Lỗi kết nối khi cập nhật trạng thái Zalo" });
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-3">
            <span className="p-2.5 bg-[#064E3B]/10 rounded-2xl text-[#064E3B] text-2xl">⚙️</span>
            Cài đặt Hệ thống
          </h1>
          <p className="mt-1 text-sm text-neutral-500 font-medium">
            Quản lý cấu hình tích hợp Zalo, thông báo và các thiết lập toàn hệ thống.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab("zalo")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "zalo"
              ? "border-[#064E3B] text-[#064E3B] bg-[#064E3B]/5 rounded-t-xl"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          <span>💬</span>
          <span>1. Chứng thực Zalo (ZNS / OA)</span>
        </button>
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "general"
              ? "border-[#064E3B] text-[#064E3B] bg-[#064E3B]/5 rounded-t-xl"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          <span>🌐</span>
          <span>2. Cài đặt Chung</span>
        </button>
      </div>

      {/* Global Alert Notification */}
      {message && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <span className="text-xl">{message.type === "success" ? "✅" : "⚠️"}</span>
          <div className="flex-1 text-sm font-semibold">{message.text}</div>
          <button
            onClick={() => setMessage(null)}
            className="text-neutral-400 hover:text-neutral-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: ZALO SETTINGS */}
      {activeTab === "zalo" && (
        <div className="space-y-6">
          {/* Main Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-neutral-200 space-y-8">
            {/* Top Bar: Title & Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-neutral-100">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-neutral-900">Chứng thực Zalo Official Account</h2>
                  {loading ? (
                    <span className="px-3 py-1 bg-neutral-100 text-neutral-500 text-xs font-bold rounded-full animate-pulse">
                      Đang tải...
                    </span>
                  ) : status?.configured ? (
                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-full border ${
                        status.enabled
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}
                    >
                      {status.enabled ? "🟢 Đang Bật" : "🟡 Đã Tắt"}
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-full">
                      🔴 Chưa kích hoạt
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">
                  Tự động cấp và refresh Zalo Access Token / Refresh Token để gửi OTP ZNS và tin nhắn OA.
                </p>
              </div>

              {/* Toggle Enable Button */}
              {status?.configured && (
                <div className="flex items-center gap-3 bg-neutral-50 p-2 rounded-2xl border border-neutral-200 self-start sm:self-auto">
                  <span className="text-xs font-bold text-neutral-700 pl-2">Chứng thực Zalo:</span>
                  <button
                    type="button"
                    disabled={toggling}
                    onClick={() => handleToggleEnable(!status.enabled)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      status.enabled ? "bg-[#064E3B]" : "bg-neutral-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        status.enabled ? "translate-x-7" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Current Token Status Dashboard */}
            {status?.configured && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                  <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Hạn dùng Token</span>
                  <div className="mt-1 text-sm font-extrabold text-neutral-900">
                    {status.expiresAt ? new Date(status.expiresAt).toLocaleString("vi-VN") : "N/A"}
                  </div>
                  {status.isExpiringSoon && (
                    <span className="text-[11px] font-bold text-amber-600 mt-1 block">⚠️ Sắp hết hạn (sẽ tự động refresh)</span>
                  )}
                </div>
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                  <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Access Token (DB)</span>
                  <div className="mt-1 text-xs font-mono font-bold text-neutral-700 truncate">
                    {status.accessTokenMasked || "Chưa có"}
                  </div>
                </div>
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                  <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Refresh Token (DB)</span>
                  <div className="mt-1 text-xs font-mono font-bold text-neutral-700 truncate">
                    {status.refreshTokenMasked || "Chưa có"}
                  </div>
                </div>
              </div>
            )}

            {/* Activation Form */}
            <div className="bg-neutral-50/70 p-6 rounded-2xl border border-neutral-200 space-y-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span>🔑</span>
                  <span>Kích hoạt / Cập nhật Chứng thực bằng Authorization Code</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Nhập <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 font-bold text-neutral-800">authorization_code</code> lấy từ Zalo Developer Console hoặc liên kết đăng nhập OAuth Zalo để khởi tạo Access Token và Refresh Token mới.
                </p>
              </div>

              <form onSubmit={handleActivateZalo} className="space-y-4">
                <div>
                  <label htmlFor="authCode" className="block text-xs font-bold text-neutral-700 mb-1.5">
                    Authorization Code:
                  </label>
                  <input
                    id="authCode"
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="Dán mã authorization_code tại đây..."
                    className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#064E3B] focus:border-[#064E3B] outline-none transition"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-3 bg-[#064E3B] text-white text-sm font-bold rounded-xl hover:bg-[#064E3B]/90 focus:ring-4 focus:ring-[#064E3B]/20 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Đang xử lý kích hoạt...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>Kích hoạt Chứng thực Zalo</span>
                      </>
                    )}
                  </button>

                  <a
                    href="https://developers.zalo.me"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#064E3B] hover:underline"
                  >
                    Lấy code tại Zalo Developer ↗
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GENERAL SETTINGS (PLACEHOLDER) */}
      {activeTab === "general" && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-200 space-y-4 text-center py-16">
          <span className="text-4xl">🌐</span>
          <h3 className="text-lg font-bold text-neutral-800">Cài đặt Chung hệ thống</h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            Các tính năng cấu hình chung khác như thông báo SMS, email gateway và cài đặt bảo mật sẽ được bổ sung tại đây.
          </p>
        </div>
      )}
    </div>
  );
}
