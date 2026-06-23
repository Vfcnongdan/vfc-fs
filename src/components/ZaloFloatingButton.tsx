"use client";

import { useState, useEffect } from "react";

export function ZaloFloatingButton() {
  const [zaloLink, setZaloLink] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/zalo-contact")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.phone) {
          setZaloLink(`https://zalo.me/${data.phone}`);
          setContactName(data.name ?? null);
        }
      })
      .catch(() => {});
  }, []);

  if (!zaloLink) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 sm:bottom-8 sm:right-8 flex items-center justify-center group">
      <style>{`
        @keyframes broadcast {
          0% { transform: scale(1); opacity: 0.2; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        .broadcast-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 9999px;
          background: #3b82f6;
          animation: broadcast 4s infinite;
          z-index: -1;
        }
      `}</style>

      {/* Tooltip */}
      {contactName && (
        <div className="absolute bottom-full mb-2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
          <span className="font-medium opacity-70">Liên hệ:</span> {contactName}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-black/80"></div>
        </div>
      )}

      <a
        href={zaloLink}
        target="_blank"
        rel="noreferrer"
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
      >
        <div className="broadcast-ring"></div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
          <span className="text-base">💬</span>
        </div>
      </a>
    </div>
  );
}
