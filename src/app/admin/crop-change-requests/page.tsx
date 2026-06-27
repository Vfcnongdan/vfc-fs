"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { CropChangeRequestStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';

type CropChangeRequest = {
  id: string;
  status: string;
  requester: { name: string | null; phone: string; role: string };
  reviewer: { name: string | null; phone: string; role: string };
  reviewerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  currentCropIds: string[];
  requestedCropIds: string[];
  currentCropNames: (string | null)[];
  requestedCropNames: (string | null)[];
};

type PageData = {
  data: CropChangeRequest[];
  total: number;
  page: number;
  limit: number;
};

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  PENDING: { label: "Chờ duyệt", class: "bg-amber-100 text-amber-700 border-amber-200" },
  APPROVED: { label: "Đã chấp nhận", class: "bg-green-100 text-green-700 border-green-200" },
  REJECTED: { label: "Đã từ chối", class: "bg-red-100 text-red-700 border-red-200" },
};

function cropNames(names: (string | null)[]) {
  const valid = names.filter((n): n is string => Boolean(n));
  return valid.length === 0 ? "Chưa chọn cây trồng" : valid.join(", ");
}

function getFocusId(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("focus");
}

export default function CropChangeRequestsPage() {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [requests, setRequests] = useState<CropChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState<"APPROVE" | "REJECT" | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setFocusId(getFocusId());
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (filterStatus) qs.set("status", filterStatus);
      const res = await fetch(`/api/crop-change-requests?${qs}`);
      const data: PageData = await res.json();
      if (res.ok) {
        setRequests(data.data ?? []);
        setTotalPages(Math.ceil(data.total / data.limit));
      }
    } catch (error) {
      console.error("Failed to fetch crop change requests", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [page, filterStatus]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "PENDING").length,
    [requests],
  );

  // Focus from notification
  useEffect(() => {
    if (!focusId || !requests.length) return;
    const target = requests.find((r) => r.id === focusId);
    if (!target) return;

    setExpandedId(focusId);
    setReviewNote(target.reviewerNote ?? "");
    setReviewError(null);

    const el = itemRefs.current[focusId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusId, requests]);

  async function handleReview(id: string, action: "APPROVE" | "REJECT") {
    setReviewingId(id);
    setSubmitting(action);
    setReviewError(null);
    try {
      const res = await fetch(`/api/crop-change-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: reviewNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duyệt yêu cầu thất bại");
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: data.status,
                reviewerNote: reviewNote,
                reviewedAt: new Date().toISOString(),
              }
            : r,
        ),
      );
      setExpandedId(null);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSubmitting(null);
      setReviewingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#064E3B] uppercase tracking-tight">🌱 Duyệt cây trồng</h1>
          <p className="text-sm text-neutral-500">
            Yêu cầu thay đổi danh sách cây trồng của nông dân
            {pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                {pendingCount} mới
              </span>
            )}
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50"
        >
          ← Quay lại
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex rounded-xl border border-neutral-200 bg-white p-1">
          {[
            { value: "", label: "Tất cả" },
            { value: "PENDING", label: "Chờ duyệt" },
            { value: "APPROVED", label: "Đã duyệt" },
            { value: "REJECTED", label: "Đã từ chối" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setFilterStatus(item.value);
                setPage(1);
                setExpandedId(null);
              }}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                filterStatus === item.value
                  ? "bg-[#064E3B] text-[#FFD680] shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-neutral-100" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-sm text-neutral-400">Không có yêu cầu nào</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {requests.map((req) => {
              const isExpanded = expandedId === req.id;
              const isPending = req.status === "PENDING";
              const isFocused = focusId === req.id;

              return (
                <div
                  key={req.id}
                  ref={(el) => { itemRefs.current[req.id] = el; }}
                  className={`transition ${
                    isFocused ? "ring-2 ring-[#064E3B] ring-offset-2" : ""
                  }`}
                >
                  <div
                    className={`flex flex-col gap-3 p-4 sm:p-5 cursor-pointer transition ${
                      isPending ? "hover:bg-neutral-50/50" : "opacity-75"
                    }`}
                    onClick={() => {
                      if (isPending) {
                        setExpandedId(isExpanded ? null : req.id);
                        setReviewNote(req.reviewerNote ?? "");
                        setReviewError(null);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-neutral-800">{req.requester.name ?? "Nông dân"}</p>
                          <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase bg-neutral-100 text-neutral-600 border-neutral-200">
                            {req.requester.role}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_MAP[req.status]?.class}`}
                          >
                            {STATUS_MAP[req.status]?.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">{req.requester.phone}</p>
                      </div>
                      <div className="text-right text-[10px] text-neutral-400">
                        <div>{new Date(req.createdAt).toLocaleDateString("vi-VN")}</div>
                        <div>{new Date(req.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Hiện tại</p>
                        <p className="mt-1 text-xs text-neutral-600 line-clamp-2">
                          {cropNames(req.currentCropNames)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase">Đề xuất</p>
                        <p className="mt-1 text-xs text-neutral-800 line-clamp-2">
                          {cropNames(req.requestedCropNames)}
                        </p>
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1.5 text-[10px] font-black text-amber-700 uppercase tracking-wide">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Cần duyệt
                        </span>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">
                          {isExpanded ? "▼ Đang mở" : "▶ Nhấn để duyệt"}
                        </span>
                      </div>
                    )}
                  </div>

                  {isExpanded && isPending && (
                    <div className="border-t border-neutral-100 bg-white p-4 sm:p-5 animate-fade-in">
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">
                            Ghi chú duyệt
                          </label>
                          <textarea
                            value={reviewingId === req.id ? reviewNote : req.reviewerNote ?? ""}
                            onChange={(e) => setReviewNote(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                            placeholder="Lý do từ chối hoặc ghi chú nội bộ"
                          />
                        </div>

                        {reviewingId === req.id && reviewError && (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {reviewError}
                          </div>
                        )}

                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            disabled={submitting !== null}
                            onClick={() => handleReview(req.id, "REJECT")}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <X size={16} />
                            Từ chối
                          </button>
                          <button
                            type="button"
                            disabled={submitting !== null}
                            onClick={() => handleReview(req.id, "APPROVE")}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Check size={16} />
                            Chấp nhận
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {req.status !== "PENDING" && req.reviewerNote && (
                    <div className="border-t border-neutral-100 bg-neutral-50/50 px-4 py-3 sm:px-5">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Ghi chú duyệt</p>
                      <p className="mt-1 text-xs text-neutral-600">{req.reviewerNote}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500 font-medium">Trang {page} / {totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50 hover:bg-neutral-50"
            >
              Trước
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50 hover:bg-neutral-50"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
