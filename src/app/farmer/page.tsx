"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Camera, Package, MapPin, Plus } from "lucide-react";
import { getCropImagePath } from "@/lib/cropIcons";
import { useCropStore } from "@/store/useCropStore";
import { WeatherBadge } from "@/components/WeatherBadge";
import { removeStoredToken } from "@/lib/auth-client";

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
          removeStoredToken(); // Xóa token cũ khỏi localStorage trước khi redirect
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
    <div className="flex flex-col flex-1 justify-between gap-4">
      <div className="flex flex-col gap-4">
        <div className="card flex justify-between items-center bg-gradient-to-r from-green-600 to-emerald-500 text-white p-4 rounded-2xl shadow-lg">
          <div>
            <h2 className="text-xl font-bold">
              Xin chào, {user?.name || "Nông dân"}! 👋
            </h2>
            <p className="mt-1 text-sm text-white/90">
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
        <div className="card bg-vfc-mint border border-vfc-green/10 text-vfc-green p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-vfc-green">Cây trồng của tôi</h3>
            {userCrops.length > 0 && (
              <Link
                href="/farmer/crops/select"
                className="text-xs font-semibold text-vfc-green/80 hover:text-vfc-green hover:underline"
              >
                Chỉnh sửa
              </Link>
            )}
          </div>
          <p className="text-xs text-vfc-green/70 mb-3">
            Thêm các loại cây trồng để nhận biết thông tin liên quan mới nhất
          </p>

          {loading ? (
            <div className="h-16 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-vfc-green"></div>
            </div>
          ) : userCrops.length > 0 ? (
            <div className="flex overflow-x-auto gap-3 pt-1 pb-1 snap-x scrollbar-hide">
              <Link
                href="/farmer/crops/select"
                className="flex flex-col items-center gap-1.5 shrink-0 snap-start w-[52px] group"
              >
                <div className="w-[48px] h-[48px] rounded-full bg-white/80 border border-dashed border-vfc-green/30 flex items-center justify-center transition-all group-hover:bg-white group-hover:border-vfc-green/60 shadow-xs">
                  <Plus className="text-vfc-green/70 group-hover:text-vfc-green transition-colors" size={18} />
                </div>
                <span className="text-[10px] font-medium text-center text-vfc-green/70 leading-tight">
                  Thêm
                </span>
              </Link>
              {userCrops.map((crop) => (
                <div
                  key={crop.id}
                  className="flex flex-col items-center gap-1.5 shrink-0 snap-start w-[52px]"
                >
                  <div className="relative w-[48px] h-[48px] rounded-full overflow-hidden ring-1 ring-vfc-green/20 bg-white shadow-xs">
                    <Image
                      src={crop.imageUrl || getCropImagePath(crop.cropCode, crop.name)}
                      alt={crop.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-center text-vfc-green leading-tight truncate w-full px-0.5">
                    {crop.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Link
              href="/farmer/crops/select"
              className="w-full py-2.5 bg-vfc-green text-white text-xs font-bold rounded-xl text-center transition-all hover:bg-emerald-900 active:scale-[0.98] uppercase tracking-wider block shadow-sm"
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

      <WeatherBadge />
    </div>
  );
}
