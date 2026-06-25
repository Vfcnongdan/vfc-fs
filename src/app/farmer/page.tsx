"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Camera, Package, MapPin, Plus } from "lucide-react";
import { getCropImagePath } from "@/lib/cropIcons";
import { useCropStore } from "@/store/useCropStore";

export default function FarmerHomePage() {
  const [user, setUser] = useState<{ name: string | null } | null>(null);
  const { userCrops, fetchUserCrops, isLoading: cropsLoading } = useCropStore();
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        fetchUserCrops();
        const userRes = await fetch("/api/auth/me");
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        } else if (userRes.status === 401) {
          window.location.href = "/";
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoadingUser(false);
      }
    }
    fetchData();
  }, [fetchUserCrops]);

  const loading = loadingUser || cropsLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex justify-between items-center bg-gradient-to-r from-green-600 to-emerald-500 text-white p-4 rounded-2xl shadow-lg">
        <div>
          <h2 className="text-xl font-bold">
            Xin chào, {user?.name || "Nông dân"}! 👋
          </h2>
          <p className="mt-1 text-sm text-green-500">
            Cây của bạn hôm nay thế nào?
          </p>
        </div>
        <Link
          href="/farmer/diagnose"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-green-700 hover:bg-green-50 transition shadow-sm"
        >
          <Camera size={30} />
        </Link>
      </div>

      {/* My Crops Section */}
      <div className="card bg-[#0C4A3F] border border-white/10 text-white p-4 rounded-2xl shadow-md">
        <h3 className="text-lg font-bold">Cây trồng của tôi</h3>
        <p className="text-xs text-white/70 mt-1 mb-4">
          Thêm các loại cây trồng để nhận biết thông tin liên quan mới nhất
        </p>

        {loading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FFD680]"></div>
          </div>
        ) : userCrops.length > 0 ? (
          <div className="flex overflow-x-auto gap-3 pt-1 pb-4 snap-x scrollbar-hide">
            <Link
              href="/farmer/crops/select"
              className="flex flex-col items-center gap-1.5 shrink-0 snap-start w-[54px] group"
            >
              <div className="w-[50px] h-[50px] rounded-full bg-white/5 border border-dashed border-white/30 flex items-center justify-center transition-colors group-hover:bg-white/10">
                <Plus className="text-white/50" size={20} />
              </div>
            </Link>
            {userCrops.map((crop) => (
              <div
                key={crop.id}
                className="flex flex-col items-center gap-1.5 shrink-0 snap-start w-[54px]"
              >
                <div className="relative w-[50px] h-[50px]">
                  <div className="w-full h-full rounded-full overflow-hidden ring-1 ring-[#FFD680]">
                    <Image
                      src={crop.imageUrl || getCropImagePath(crop.cropCode)}
                      alt={crop.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                    <span className="block text-[7px] font-bold text-center text-white leading-tight break-words px-1.5">
                      {crop.name}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Link
            href="/farmer/crops/select"
            className="w-full p-2 mb-4 bg-[#FFD680] text-[#0C4A3F] text-sm font-black rounded-lg text-center transition-all active:scale-[0.98] uppercase shadow-lg"
          >
            Thêm loại cây trồng
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/farmer/diagnose"
          className="card flex flex-col items-center gap-2 p-4 text-center hover:ring-2 hover:ring-green-400 transition-all bg-white border border-neutral-100 shadow-sm rounded-2xl"
        >
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-1">
            <Camera className="text-green-600" size={24} />
          </div>
          <div>
            <span className="font-bold text-sm block">Chuẩn đoán bệnh</span>
            <span className="text-[10px] text-neutral-500">
              AI phân tích tức thì
            </span>
          </div>
        </Link>
        <Link
          href="/farmer/orders"
          className="card flex flex-col items-center gap-2 p-4 text-center hover:ring-2 hover:ring-green-400 transition-all bg-white border border-neutral-100 shadow-sm rounded-2xl"
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-1">
            <Package className="text-blue-600" size={24} />
          </div>
          <div>
            <span className="font-bold text-sm block">Đơn hàng của tôi</span>
            <span className="text-[10px] text-neutral-500">
              Theo dõi tình trạng
            </span>
          </div>
        </Link>
        <a
          href="https://map.vfcnongdan.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="card flex flex-col items-center gap-2 p-4 text-center hover:ring-2 hover:ring-blue-400 transition-all bg-white border border-neutral-100 shadow-sm rounded-2xl"
        >
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mb-1">
            <MapPin className="text-orange-600" size={24} />
          </div>
          <div>
            <span className="font-bold text-sm block">Bản đồ</span>
            <span className="text-[10px] text-neutral-500">Vùng trồng VFC</span>
          </div>
        </a>
      </div>
    </div>
  );
}
