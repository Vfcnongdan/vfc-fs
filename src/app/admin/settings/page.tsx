"use client";

import { useState, useEffect } from "react";

interface ZaloStatus {
  configured: boolean;
  enabled: boolean;
  expiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  accessTokenMasked?: string;
  refreshTokenMasked?: string;
  isExpiringSoon?: boolean;
  refreshTokenAlertLevel?: "ok" | "warning" | "critical" | "expired" | "unknown";
  refreshTokenDaysLeft?: number | null;
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<"zalo" | "general">("zalo");
  const [status, setStatus] = useState<ZaloStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessTokenInput, setAccessTokenInput] = useState("");
  const [refreshTokenInput, setRefreshTokenInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testingOtp, setTestingOtp] = useState(false);
  const [testOtpResult, setTestOtpResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    } catch {
      setMessage({ type: "error", text: "Lỗi kết nối khi tải cấu hình Zalo" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessTokenInput.trim()) {
      setMessage({ type: "error", text: "Vui lòng nhập Access Token" });
      return;
    }
    if (!refreshTokenInput.trim()) {
      setMessage({ type: "error", text: "Vui lòng nhập Refresh Token" });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);
      const res = await fetch("/api/admin/settings/zalo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: accessTokenInput.trim(),
          refreshToken: refreshTokenInput.trim(),
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: "success", text: data.message || "Lưu token thành công!" });
        setAccessTokenInput("");
        setRefreshTokenInput("");
        await fetchStatus();
      } else {
        setMessage({ type: "error", text: data.error || data.message || "Lưu token thất bại" });
      }
    } catch {
      setMessage({ type: "error", text: "Lỗi kết nối tới máy chủ khi lưu token" });
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
    } catch {
      setMessage({ type: "error", text: "Lỗi kết nối khi cập nhật trạng thái Zalo" });
    } finally {
      setToggling(false);
    }
  };

  const handleForceRefresh = async () => {
    try {
      setRefreshingToken(true);
      setMessage(null);
      const res = await fetch("/api/admin/settings/zalo/refresh", {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          type: "success",
          text: data.message || "Làm mới Zalo Access Token và Refresh Token thành công!",
        });
        if (data.status) {
          setStatus(data.status);
        } else {
          await fetchStatus();
        }
      } else {
        setMessage({
          type: "error",
          text: data.error || data.message || "Làm mới token thất bại. Vui lòng kiểm tra lại Refresh Token.",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Lỗi kết nối tới máy chủ khi làm mới token" });
    } finally {
      setRefreshingToken(false);
    }
  };

  const handleTestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      setTestOtpResult({ type: "error", text: "Vui lòng nhập số điện thoại" });
      return;
    }
    try {
      setTestingOtp(true);
      setTestOtpResult(null);
      const res = await fetch("/api/admin/settings/zalo/test-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestOtpResult({ type: "success", text: data.message + (data.note ? ` ${data.note}` : "") });
      } else {
        setTestOtpResult({ type: "error", text: data.error || data.message || "Gửi OTP thất bại" });
      }
    } catch {
      setTestOtpResult({ type: "error", text: "Lỗi kết nối khi gửi OTP test" });
    } finally {
      setTestingOtp(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-3">
            <span className="p-2.5 bg-vfc-green/10 rounded-2xl text-vfc-green text-2xl">⚙️</span>
            Cài đặt Hệ thống
          </h1>
          <p className="mt-1 text-sm text-neutral-500 font-medium">
            Quản lý cấu hình tích hợp Zalo, trạng thái token và các thiết lập toàn hệ thống.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab("zalo")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "zalo"
              ? "border-vfc-green text-vfc-green bg-vfc-green/5 rounded-t-xl"
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
              ? "border-vfc-green text-vfc-green bg-vfc-green/5 rounded-t-xl"
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
            {/* Top Bar: Title & Actions */}
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
                  Hệ thống tự động gia hạn Access Token (25 giờ) và xoay vòng Refresh Token (90 ngày) hoàn toàn tự động.
                </p>
              </div>

              {/* Actions: Refresh Now & Toggle Enable */}
              {status?.configured && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={refreshingToken}
                    onClick={handleForceRefresh}
                    className="flex items-center gap-2 px-4 py-2 bg-vfc-green hover:bg-vfc-green/90 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                    title="Chủ động đổi lấy cặp Access Token + Refresh Token mới ngay lập tức"
                  >
                    {refreshingToken ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Đang làm mới...</span>
                      </>
                    ) : (
                      <>
                        <span>🔄</span>
                        <span>Làm mới Token ngay</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-3 bg-neutral-50 p-2 rounded-2xl border border-neutral-200">
                    <span className="text-xs font-bold text-neutral-700 pl-2">Chứng thực Zalo:</span>
                    <button
                      type="button"
                      disabled={toggling}
                      onClick={() => handleToggleEnable(!status.enabled)}
                      className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        status.enabled ? "bg-vfc-green" : "bg-neutral-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          status.enabled ? "translate-x-7" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Current Token Status Dashboard */}
            {status?.configured && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Card 1: Token Expiration */}
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Hạn dùng Access Token</span>
                    <div className="mt-1 text-sm font-extrabold text-neutral-900">
                      {status.expiresAt ? new Date(status.expiresAt).toLocaleString("vi-VN") : "N/A"}
                    </div>
                    {status.isExpiringSoon ? (
                      <span className="text-[11px] font-bold text-amber-600 mt-1 block">
                        ⚠️ Sắp hết hạn (sẽ tự động refresh ngầm)
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                        ✓ Đang còn hiệu lực
                      </span>
                    )}
                  </div>

                  {/* Card 2: Masked Access Token */}
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Access Token (DB)</span>
                    <div className="mt-1 text-xs font-mono font-bold text-neutral-700 truncate">
                      {status.accessTokenMasked || "Chưa có"}
                    </div>
                    <span className="text-[11px] text-neutral-400 mt-1 block">Hạn dùng ~25 giờ</span>
                  </div>

                  {/* Card 3: Masked Refresh Token */}
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Refresh Token (DB)</span>
                    <div className="mt-1 text-xs font-mono font-bold text-neutral-700 truncate">
                      {status.refreshTokenMasked || "Chưa có"}
                    </div>
                    <span className="text-[11px] text-neutral-400 mt-1 block">
                      {status.refreshTokenDaysLeft !== null
                        ? `Còn ~${status.refreshTokenDaysLeft} ngày (tự động reset 90 ngày mỗi khi refresh)`
                        : "Hạn 90 ngày"}
                    </span>
                  </div>
                </div>

                {/* Refresh Token Expiry Alert Panel */}
                {(() => {
                  const level = status.refreshTokenAlertLevel;
                  const days = status.refreshTokenDaysLeft;
                  if (!level || level === "ok") return null;
                  const configs = {
                    expired: {
                      bg: "bg-red-50 border-red-300",
                      icon: "⛔",
                      title: "Refresh Token Zalo đã hết hạn!",
                      body: "Hệ thống không thể tự động làm mới Access Token. Vui lòng nhập lại cặp token mới từ Zalo Developer Console.",
                      textColor: "text-red-900",
                      subColor: "text-red-700",
                    },
                    critical: {
                      bg: "bg-red-50 border-red-200",
                      icon: "🔴",
                      title: `Refresh Token sắp hết hạn trong ${days} ngày!`,
                      body: "Hãy bấm 'Làm mới Token ngay' để Zalo cấp lại Refresh Token 90 ngày mới.",
                      textColor: "text-red-900",
                      subColor: "text-red-700",
                    },
                    warning: {
                      bg: "bg-amber-50 border-amber-200",
                      icon: "🟡",
                      title: `Refresh Token còn ${days} ngày`,
                      body: "Khi hệ thống tự động làm mới Access Token, Refresh Token cũng sẽ được xoay vòng gia hạn thêm 90 ngày.",
                      textColor: "text-amber-900",
                      subColor: "text-amber-700",
                    },
                    unknown: {
                      bg: "bg-neutral-50 border-neutral-200",
                      icon: "❓",
                      title: "Chưa xác định hạn Refresh Token",
                      body: "Bấm 'Làm mới Token ngay' để hệ thống đồng bộ lại hạn dùng 90 ngày.",
                      textColor: "text-neutral-900",
                      subColor: "text-neutral-600",
                    },
                  };
                  const cfg = configs[level as keyof typeof configs];
                  if (!cfg) return null;
                  return (
                    <div className={`p-4 rounded-2xl border flex items-start gap-3 ${cfg.bg}`}>
                      <span className="text-2xl mt-0.5">{cfg.icon}</span>
                      <div>
                        <p className={`text-sm font-extrabold ${cfg.textColor}`}>{cfg.title}</p>
                        <p className={`text-xs mt-0.5 ${cfg.subColor}`}>{cfg.body}</p>
                        {status.refreshTokenExpiresAt && (
                          <p className={`text-[11px] mt-1 font-mono ${cfg.subColor} opacity-70`}>
                            Hạn: {new Date(status.refreshTokenExpiresAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Direct Token Input Form */}
            <div className="bg-neutral-50/70 p-6 rounded-2xl border border-neutral-200 space-y-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span>🔑</span>
                  <span>Nhập Token trực tiếp từ Zalo Developer</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Chỉ cần nhập <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 font-bold text-neutral-800">Access Token</code> và <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 font-bold text-neutral-800">Refresh Token</code> <strong>lần đầu tiên duy nhất</strong> lấy từ Zalo Developer Console. Sau khi lưu, hệ thống sẽ tự động làm mới mãi mãi.
                </p>
              </div>

              <form onSubmit={handleSaveTokens} className="space-y-4">
                <div>
                  <label htmlFor="accessToken" className="block text-xs font-bold text-neutral-700 mb-1.5">
                    Access Token:
                  </label>
                  <input
                    id="accessToken"
                    type="text"
                    value={accessTokenInput}
                    onChange={(e) => setAccessTokenInput(e.target.value)}
                    placeholder="Dán Access Token tại đây..."
                    className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-vfc-green focus:border-vfc-green outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="refreshToken" className="block text-xs font-bold text-neutral-700 mb-1.5">
                    Refresh Token:
                  </label>
                  <input
                    id="refreshToken"
                    type="text"
                    value={refreshTokenInput}
                    onChange={(e) => setRefreshTokenInput(e.target.value)}
                    placeholder="Dán Refresh Token tại đây..."
                    className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-vfc-green focus:border-vfc-green outline-none transition"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-3 bg-vfc-green text-white text-sm font-bold rounded-xl hover:bg-vfc-green/90 focus:ring-4 focus:ring-vfc-green/20 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Đang lưu token...</span>
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        <span>Lưu Token vào Database</span>
                      </>
                    )}
                  </button>

                  <a
                    href="https://developers.zalo.me"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-vfc-green hover:underline"
                  >
                    Zalo Developer Console ↗
                  </a>
                </div>
              </form>
            </div>

            {/* Smoke Test OTP Section */}
            <div className="bg-blue-50/60 p-6 rounded-2xl border border-blue-200 space-y-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span>🧪</span>
                  <span>Kiểm tra kết nối Zalo (Smoke Test)</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Gửi một OTP test thực tế tới số điện thoại để xác nhận Zalo token đang hoạt động. OTP sẽ là{" "}
                  <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 font-bold text-neutral-800">123456</code>{" "}
                  (không hợp lệ để đăng nhập, chỉ dùng để test).
                </p>
              </div>

              <form onSubmit={handleTestOtp} className="flex flex-col sm:flex-row gap-3">
                <input
                  id="testPhone"
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Nhập số điện thoại (09x, 08x, 03x...)"
                  className="flex-1 px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
                />
                <button
                  type="submit"
                  disabled={testingOtp}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 shadow-sm whitespace-nowrap"
                >
                  {testingOtp ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <span>📤</span>
                      <span>Gửi OTP Test</span>
                    </>
                  )}
                </button>
              </form>

              {testOtpResult && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-sm ${
                    testOtpResult.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}
                >
                  <span className="text-base mt-0.5">{testOtpResult.type === "success" ? "✅" : "❌"}</span>
                  <span className="font-semibold">{testOtpResult.text}</span>
                </div>
              )}
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