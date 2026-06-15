"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { getCropIcon } from "@/lib/cropIcons";

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
    <main className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#0C4A3F] font-sans">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-white/5">
        <div className="w-16">
          <Link href="/farmer" className="text-white inline-block">
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
        <h1 className="text-white font-bold text-lg flex-1 text-center truncate px-2">
          Thêm loại cây trồng
        </h1>
        <div className="w-16 text-right">
          <button
            onClick={() => setSelectedIds([])}
            disabled={selectedIds.length === 0}
            className="text-[#FFD680] text-sm font-bold active:scale-95 disabled:opacity-0 transition-opacity"
          >
            Bỏ hết
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm kiếm cây trồng"
            className="w-full bg-white rounded-md px-4 py-3 text-gray-800 placeholder:text-gray-400 outline-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-6 overflow-y-auto pb-32 pt-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-x-4 gap-y-6">
            {filteredCrops.map((crop) => (
              <button
                key={crop.id}
                onClick={() => toggleCrop(crop.id)}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`relative w-10 h-10 rounded-full overflow-hidden transition-all flex items-center justify-center ${
                    selectedIds.includes(crop.id)
                      ? "ring-2 ring-[#FFD680]"
                      : "ring-1 ring-white/20"
                  }`}
                  style={{ backgroundColor: getCropIcon(crop.cropCode).bg + "cc" }}
                >
                  <span className="text-2xl leading-none select-none">
                    {getCropIcon(crop.cropCode).emoji}
                  </span>
                  {selectedIds.includes(crop.id) && (
                    <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                      <div className="bg-green-500 rounded-full p-0.5 shadow-lg">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-white text-[10px] font-bold text-center group-active:scale-95 transition-transform">
                  {crop.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0C4A3F] to-transparent">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-[#FFD680] text-[#0C4A3F] text-lg font-black rounded-full shadow-xl transition-all hover:brightness-105 active:scale-95 disabled:opacity-50 uppercase tracking-widest"
        >
          {saving ? "ĐANG LƯU..." : "LƯU"}
        </button>
      </div>

      {/* Background decoration */}
      <div className="fixed bottom-0 right-0 w-full h-1/2 pointer-events-none opacity-20">
        <Image
          src="/assets/images/bg.svg"
          alt="decor"
          fill
          className="object-cover object-bottom"
        />
      </div>
    </main>
  );
}
