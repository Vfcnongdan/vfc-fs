"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PageLoadingOverlay from "@/components/PageLoadingOverlay";

type Step = "phone" | "otp";

export default function HomePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Auto-redirect if already logged in + load last phone
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          router.push("/farmer");
          router.refresh();
          return;
        }
      } catch {
        // Not logged in
      }

      setCheckingSession(false);
      const lastPhone = localStorage.getItem("lastPhone");
      if (lastPhone) setPhone(lastPhone);
    }
    checkSession();
  }, [router]);

  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (step === "phone" && !agreed) {
      setError("Bạn cần đồng ý với Điều khoản & Điều kiện");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gửi OTP thất bại");
      localStorage.setItem("lastPhone", phone);
      setStep("otp");
      setOtp(["", "", "", ""]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(currentOtp: string[]) {
    const fullOtp = currentOtp.join("");
    if (fullOtp.length !== 4) return;

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: fullOtp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Xác thực OTP thất bại");

      console.log("Login success, role:", data.user?.role);
      
      router.refresh();
      router.push("/farmer");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setOtp(["", "", "", ""]);
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < 3) {
      otpRefs[index + 1].current?.focus();
    }

    if (newOtp.every((digit) => digit !== "")) {
      handleVerifyOtp(newOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pastedData) return;

    const newOtp = ["", "", "", ""];
    const digits = pastedData.split("");
    digits.forEach((digit, i) => {
      newOtp[i] = digit;
    });
    setOtp(newOtp);

    const nextIndex = Math.min(digits.length, 3);
    otpRefs[nextIndex].current?.focus();

    if (newOtp.every((digit) => digit !== "")) {
      handleVerifyOtp(newOtp);
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center px-8 pt-6 bg-[#0C4A3F] overflow-hidden font-sans">
      {checkingSession && <PageLoadingOverlay message="Đang đăng nhập..." />}
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/images/bg.svg"
          alt="background"
          fill
          className="object-cover opacity-40"
          priority
        />
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center h-full min-h-[95vh]">
        {/* Cancel Button */}
        <div className="w-full flex justify-end min-h-[44px]">
          {step === "otp" && (
            <button
              onClick={() => {
                setStep("phone");
                setOtp(["", "", "", ""]);
              }}
              className="text-white text-lg font-bold py-2"
            >
              Hủy
            </button>
          )}
        </div>

        {/* Top Banner/Logo */}
        <div className="w-full flex justify-center mb-8 mt-4">
          <Image
            src="/assets/images/banner.svg"
            alt="VFC Banner"
            width={220}
            height={140}
            className="drop-shadow-2xl"
          />
        </div>

        {step === "phone" ? (
          <>
            <h1 className="text-3xl font-bold text-white mb-8 tracking-wider drop-shadow-md text-center">
              ĐĂNG NHẬP
            </h1>
            <form onSubmit={handleSendOtp} className="w-full space-y-4">
              <div className="space-y-1">
                <label className="text-white text-sm font-medium">
                  Số điện thoại*
                </label>
                <div className="flex w-full">
                  <input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    placeholder="Nhập vào số điện thoại"
                    className="w-full bg-white/90 rounded-md px-4 py-3 outline-none text-gray-800 placeholder:text-gray-400 font-medium shadow-sm"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <p className="text-white/80 text-[11px] mt-2 italic text-center w-full">
                  Ví dụ: 09X-xxx-xxxx hoặc 9X-xxx-xxxx
                </p>
              </div>

              <div className="pt-2">
                <p className="text-white/90 text-[11px] mb-3">
                  Bằng cách tiếp tục, Bạn đồng ý với
                </p>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-white/30 bg-transparent accent-[#FFD680] cursor-pointer shadow-inner"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                    />
                  </div>
                  <span className="text-white text-[11px] leading-relaxed">
                    Bạn đã đồng ý với{" "}
                    <a href="/terms" target="_blank" className="text-[#FFD680] font-bold underline underline-offset-2">
                      Điều Khoản &amp; Điều Kiện
                    </a>{" "}
                    và{" "}
                    <a href="/privacy" target="_blank" className="text-[#FFD680] font-bold underline underline-offset-2">
                      Chính sách quyền riêng tư
                    </a>
                  </span>
                </label>
              </div>

              {error && (
                <p className="text-red-300 text-[11px] text-center font-bold">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !agreed}
                className="w-full py-4 mt-6 bg-[#FFD680] text-[#0C4A3F] text-lg font-black rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:grayscale uppercase tracking-widest"
              >
                {loading ? "ĐANG GỬI..." : "ĐĂNG NHẬP"}
              </button>
            </form>
          </>
        ) : (
          <div className="w-full flex flex-col items-center">
            <p className="text-white text-sm font-bold text-center mb-10 leading-relaxed px-4">
              Nhập mã OTP gửi đến số điện thoại của bạn để kích hoạt OTP
            </p>

            <div className="flex gap-4 mb-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={otpRefs[index]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="w-16 h-16 bg-gray-300 rounded-sm text-center text-3xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#FFD680]"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            <button
              onClick={() => handleSendOtp()}
              className="text-white font-bold underline underline-offset-4 mb-16 decoration-2"
            >
              Gửi lại mã OTP
            </button>

            <p className="text-white text-sm font-bold text-center px-6">
              Vui lòng không tiết lộ OTP của bạn cho bất kỳ ai
            </p>

            {error && (
              <p className="text-red-300 text-sm mt-4 font-bold">{error}</p>
            )}
            {loading && (
              <p className="text-white/70 text-sm mt-4 animate-pulse">
                Đang kiểm tra...
              </p>
            )}
          </div>
        )}

        {/* Bottom Logo */}
        <div className="mt-auto pt-12 pb-8 flex flex-col items-center">
          <Image
            src="/assets/images/logo.svg"
            alt="VFC Logo"
            width={180}
            height={80}
            className="drop-shadow-lg"
          />
          <p className="text-white text-[11px] font-black tracking-[0.2em] text-center mt-2 drop-shadow-sm">
            GIÁ TRỊ ĐÍCH THỰC
          </p>
        </div>
      </div>
    </main>
  );
}
