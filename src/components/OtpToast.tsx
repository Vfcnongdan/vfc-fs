'use client';

import React from 'react';

export interface OtpToastProps {
  otp: string;
  type: 'otp' | 'otp_fallback';
  onAutofill?: () => void;
  onClose?: () => void;
}

export function OtpToast({ otp, type, onAutofill, onClose }: OtpToastProps) {
  const isReturningUser = type === 'otp';

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="relative overflow-hidden rounded-2xl bg-[#09382F]/95 backdrop-blur-md border border-[#FFD680]/40 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(255,214,128,0.2)] text-white">
        {/* Glow decorative background */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#FFD680]/20 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {isReturningUser ? '✨' : '⚡'}
            </span>
            <div>
              <h4 className="text-xs font-black tracking-wider uppercase text-[#FFD680]">
                {isReturningUser
                  ? 'Thiết bị đã ghi nhớ'
                  : 'Mã xác thực màn hình'}
              </h4>
              <p className="text-[11px] text-white/80 font-medium">
                {isReturningUser
                  ? 'Mã OTP được gửi trực tiếp đến bạn:'
                  : 'Mã dự phòng hiển thị tự động:'}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white p-1 transition rounded-md hover:bg-white/10"
              title="Đóng"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* 4 Digit Boxes */}
        <div className="mt-3 flex items-center justify-center gap-2">
          {otp.split('').map((digit, i) => (
            <span
              key={i}
              className="w-10 h-11 flex items-center justify-center text-2xl font-black text-[#0C4A3F] bg-[#FFD680] rounded-lg shadow-md tracking-wider animate-pulse"
            >
              {digit}
            </span>
          ))}
        </div>

        {/* Action / Notification */}
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/10 text-[11px]">
          <span className="text-emerald-300 font-semibold flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Đã tự động điền mã
          </span>

          {onAutofill && (
            <button
              onClick={onAutofill}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-md transition text-[10px] uppercase tracking-wide"
            >
              Điền lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
