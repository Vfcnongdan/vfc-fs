"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationResponse = {
  unreadCount: number;
  notifications: NotificationItem[];
};

function formatNotificationTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  async function loadNotifications() {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = (await res.json()) as NotificationResponse;
    setUnreadCount(data.unreadCount ?? 0);
    setNotifications(data.notifications ?? []);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(loadNotifications, 0);
    const intervalId = window.setInterval(loadNotifications, 300000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  async function markRead(notification: NotificationItem) {
    setOpen(false);
    if (!notification.isRead) {
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" }).catch(() => {});
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="Thông báo"
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
          dark
            ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
            : "border-neutral-200 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50"
        }`}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-600 px-1 py-0.5 text-center text-[9px] font-bold leading-none text-white ring-2 ring-red-600">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-0 top-16 z-50 overflow-hidden border-b border-neutral-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem] sm:rounded-lg sm:border">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-neutral-800">Thông báo</h2>
            <span className="text-xs text-neutral-400">{unreadCount} chưa đọc</span>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              Chưa có thông báo
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.href}
                  onClick={() => markRead(notification)}
                  className={`block border-b border-neutral-100 px-4 py-3 transition last:border-b-0 hover:bg-green-50 ${
                    notification.isRead ? "bg-white" : "bg-emerald-50/70"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        notification.isRead ? "bg-neutral-200" : "bg-emerald-600"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-neutral-800">
                        {notification.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                        {notification.message}
                      </p>
                      <p className="mt-2 text-[10px] font-medium text-neutral-400">
                        {formatNotificationTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
