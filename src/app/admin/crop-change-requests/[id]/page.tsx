"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

type Crop = {
  id: string;
  name: string;
  cropCode: string;
};

type ChangeRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requester: { name: string | null; phone: string; role: string };
  reviewer: { name: string | null; phone: string; role: string };
  reviewerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  currentCrops: Crop[];
  requestedCrops: Crop[];
};

function cropNames(crops: Crop[]) {
  if (crops.length === 0) return "Chưa chọn cây trồng";
  return crops.map((crop) => crop.name).join(", ");
}

export default function CropChangeReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ChangeRequest | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"APPROVE" | "REJECT" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequest() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/crop-change-requests/${params.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không tải được yêu cầu duyệt");
        setRequest(data);
        setNote(data.reviewerNote ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) void loadRequest();
  }, [params.id]);

  async function review(action: "APPROVE" | "REJECT") {
    setSubmitting(action);
    setError(null);
    try {
      const res = await fetch(`/api/crop-change-requests/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duyệt yêu cầu thất bại");
      setRequest((prev) => (prev ? { ...prev, status: data.status, reviewerNote: note } : prev));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-500">
        Đang tải yêu cầu duyệt...
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-bold">Không thể mở yêu cầu</p>
        <p className="mt-1 text-sm">{error}</p>
        <Link href="/admin" className="mt-4 inline-block text-sm font-bold underline">
          Quay lại admin
        </Link>
      </div>
    );
  }

  if (!request) return null;

  const isPending = request.status === "PENDING";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <Link href="/admin" className="text-sm font-medium text-neutral-500 hover:text-neutral-800">
          Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">
          Duyệt thay đổi cây trồng
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Yêu cầu từ {request.requester.name ?? request.requester.phone} ({request.requester.role})
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
          <div>
            <p className="text-xs font-bold uppercase text-neutral-400">Trạng thái</p>
            <p className="mt-1 text-sm font-bold text-neutral-800">
              {request.status === "PENDING"
                ? "Chờ duyệt"
                : request.status === "APPROVED"
                  ? "Đã chấp nhận"
                  : "Đã từ chối"}
            </p>
          </div>
          <div className="text-right text-xs text-neutral-500">
            Gửi lúc {new Date(request.createdAt).toLocaleString("vi-VN")}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-neutral-200 p-4">
            <p className="text-xs font-bold uppercase text-neutral-400">Danh sách hiện tại</p>
            <p className="mt-3 text-sm leading-6 text-neutral-700">{cropNames(request.currentCrops)}</p>
          </section>
          <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-xs font-bold uppercase text-emerald-700">Danh sách đề xuất</p>
            <p className="mt-3 text-sm leading-6 text-neutral-800">{cropNames(request.requestedCrops)}</p>
          </section>
        </div>

        <div className="mt-5">
          <label className="text-xs font-bold uppercase text-neutral-400">Ghi chú duyệt</label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={!isPending}
            rows={3}
            className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:bg-neutral-50"
            placeholder="Lý do từ chối hoặc ghi chú nội bộ"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => review("REJECT")}
            disabled={!isPending || submitting !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} />
            Từ chối
          </button>
          <button
            type="button"
            onClick={() => review("APPROVE")}
            disabled={!isPending || submitting !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={16} />
            Chấp nhận
          </button>
        </div>
      </div>
    </div>
  );
}
