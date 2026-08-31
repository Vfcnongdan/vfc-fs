'use client';

import React from 'react';
import Image from 'next/image';

export interface OtpToastProps {
  otp: string;
  type: 'otp' | 'otp_fallback';
  onAutofill?: () => void;
  onClose?: () => void;
}

export function OtpToast({ otp, type, onAutofill, onClose }: OtpToastProps) {
  const isReturningUser = type === 'otp';

  return (
    <aside
      aria-label="Thông báo mã xác thực OTP"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-sm transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-6"
    >
      <div
        onClick={onAutofill}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAutofill?.();
          }
        }}
        className="group relative overflow-hidden rounded-2xl bg-[#1C2421]/95 backdrop-blur-xl border border-white/20 p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_15px_rgba(255,214,128,0.15)] text-white cursor-pointer hover:border-[#FFD680]/50 active:scale-[0.99] transition-all select-none"
      >
        {/* Top App Header (iOS / Android System Notification style) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#0C4A3F] border border-white/20 flex items-center justify-center p-0.5 shadow-sm">
              <Image
                src="/assets/images/logo.svg"
                alt="VFC"
                width={16}
                height={16}
                className="w-full h-auto"
              />
            </div>
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
              {isReturningUser ? 'VFC • THIẾT BỊ ĐÃ LƯU' : 'VFC • TIN NHẮN MÃ OTP'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/50 font-medium">vừa xong</span>
            {onClose && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="text-white/40 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
                title="Đóng thông báo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
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
        </div>

        {/* Message Content */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-white font-medium leading-snug">
              Mã xác thực của bạn là:{' '}
              <span className="inline-block font-mono font-black text-[#FFD680] text-base tracking-widest px-2 py-0.5 bg-black/40 rounded-md border border-[#FFD680]/30 shadow-inner ml-1">
                {otp}
              </span>
            </p>
            <p className="text-[11px] text-white/60 mt-1">
              Chạm để tự động điền hoặc nhập tay mã vào ô
            </p>
          </div>

          {/* Action Button */}
          {onAutofill && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAutofill();
              }}
              className="shrink-0 px-3 py-1.5 bg-[#FFD680] hover:bg-[#ffe09e] text-[#0C4A3F] font-bold text-xs rounded-full shadow-sm group-hover:brightness-105 active:scale-95 transition tracking-tight"
            >
              Điền mã
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
