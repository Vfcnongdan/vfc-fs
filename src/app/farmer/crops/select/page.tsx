"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { getCropImagePath } from "@/lib/cropIcons";
import { useCropStore } from "@/store/useCropStore";

interface Crop {
  id: string;
  cropCode: string;
  name: string;
  imageUrl?: string;
}

export default function SelectCropsPage() {
  const router = useRouter();
  const [allCrops, setAllCrops] = useState<Crop[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [cropsRes, userCropsRes] = await Promise.all([
          fetch("/api/crops"),
          fetch("/api/farmer/crops"),
        ]);

        if (cropsRes.ok && userCropsRes.ok) {
          const cropsData = await cropsRes.json();
          const userCropsData = await userCropsRes.json();
          setAllCrops(cropsData);
          setSelectedIds(userCropsData.map((c: Crop) => c.id));
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const toggleCrop = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/farmer/crops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropIds: selectedIds }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pendingApproval) {
          toast.success("Thay đổi cây trồng đã được gửi và đang chờ duyệt.");
        } else if (data.applied) {
          toast.success("Thay đổi cây trồng đã được cập nhật.");
          useCropStore.getState().fetchUserCrops(true);
        }
        router.push("/farmer");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Không thể gửi thay đổi cây trồng");
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const filteredCrops = allCrops.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <main className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-neutral-50 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-vfc-mint border-b border-black/10 shadow-xs">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="w-16">
            <Link
              href="/farmer"
              className="text-black/70 hover:text-vfc-green inline-flex items-center gap-1 transition-colors"
              aria-label="Quay lại"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
          </div>
          <h1 className="text-neutral-900 font-bold text-base sm:text-lg flex-1 text-center truncate px-2">
            Thêm loại cây trồng
          </h1>
          <div className="w-16 text-right">
            <button
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className="text-black/60 hover:text-red-600 text-xs sm:text-sm font-semibold active:scale-95 disabled:opacity-0 transition-opacity"
            >
              Bỏ hết
            </button>
          </div>
        </div>
      </header>

      {/* Body Content */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto pb-28">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm kiếm cây trồng..."
            className="input-field shadow-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-neutral-600">
            Danh sách cây trồng ({filteredCrops.length})
          </span>
          {selectedIds.length > 0 && (
            <span className="text-xs font-bold text-vfc-green bg-vfc-mint px-2.5 py-0.5 rounded-full border border-vfc-green/20">
              Đã chọn: {selectedIds.length}
            </span>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vfc-green"></div>
          </div>
        ) : filteredCrops.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-3xl">🌱</span>
            <p className="text-sm font-medium text-neutral-500">
              Không tìm thấy cây trồng phù hợp
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-x-3 gap-y-5">
            {filteredCrops.map((crop) => {
              const isSelected = selectedIds.includes(crop.id);
              return (
                <button
                  key={crop.id}
                  onClick={() => toggleCrop(crop.id)}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                  type="button"
                >
                  <div className="relative">
                    <div
                      className={`relative w-16 h-16 rounded-full overflow-hidden transition-all bg-white ${
                        isSelected
                          ? "ring-2 ring-emerald-600 ring-offset-2 ring-offset-neutral-50 shadow-sm"
                          : "ring-1 ring-neutral-200 group-hover:ring-neutral-300 shadow-xs"
                      }`}
                    >
                      <Image
                        src={crop.imageUrl || getCropImagePath(crop.cropCode, crop.name)}
                        alt={crop.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[11px] text-center leading-tight transition-colors line-clamp-2 px-1 ${
                      isSelected
                        ? "font-semibold text-emerald-800"
                        : "font-normal text-neutral-600 group-hover:text-neutral-900"
                    }`}
                  >
                    {crop.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-black/10 bg-vfc-mint shadow-lg">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-vfc-green text-white text-base font-bold rounded-xl shadow-md transition-all hover:bg-emerald-900 active:scale-[0.98] disabled:opacity-50 uppercase tracking-wide cursor-pointer"
          >
            {saving ? "ĐANG LƯU..." : `LƯU ${selectedIds.length > 0 ? `(${selectedIds.length})` : ""}`}
          </button>
        </div>
      </footer>
    </main>
  );
}
