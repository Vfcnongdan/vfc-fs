"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  Leaf,
  Search,
  Sprout,
  UploadCloud,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  mergeSelections,
  ProductMultiSelect,
  selectionTotal,
  type MultiSelectProduct,
} from "@/components/ProductMultiSelect";
import { cropGrowthStageOptions } from "@/lib/deseaseDetails";
import { useCropStore } from "@/store/useCropStore";

type AgencyCatalog = {
  suggested: MultiSelectProduct[];
  additional: MultiSelectProduct[];
};

type AgencyListItem = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  distance: number;
};

type UserProfile = {
  id: string;
  phone: string;
  role: string;
  name: string | null;
  area?: number | null;
  ward?: string | null;
  province?: string | null;
};

type DiagnosisResult = {
  id: string;
  status: "PROCESSING" | "DONE" | "FAILED";
  summary?: string;
  confidence?: number;
  rawAiResponse?: {
    disease?: string;
    severity?: string;
    vfcSolutionText?: string;
    solutionSets?: { name: string; products: string[] }[];
  };
  suggestions?: Array<{
    rank: number;
    reason: string;
    product?: {
      id: string;
      name: string;
      imageUrls: string[];
      slug: string;
      price?: number;
    };
  }>;
};

export default function DiagnosePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [cropType, setCropType] = useState("");
  const [growthStage, setGrowthStage] = useState("");
  const { userCrops, fetchUserCrops } = useCropStore();
  const [loading, setLoading] = useState(false);
  const [analyzeCountdown, setAnalyzeCountdown] = useState<number>(20);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState("");
  const [blockedTimeRemaining, setBlockedTimeRemaining] = useState<number>(0);
  const [agencies, setAgencies] = useState<AgencyListItem[]>([]);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<AgencyListItem | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [catalog, setCatalog] = useState<AgencyCatalog | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedSuggested, setSelectedSuggested] = useState<Map<string, number>>(new Map());
  const [selectedAdditional, setSelectedAdditional] = useState<Map<string, number>>(new Map());
  const [farmArea, setFarmArea] = useState<string>("1.0");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const preselectProductIdRef = useRef<string | null>(null);

  const suggestionProductIds = useMemo(
    () =>
      result?.suggestions
        ?.map((s) => s.product?.id)
        .filter((id): id is string => Boolean(id)) ?? [],
    [result?.suggestions],
  );

  const growthStageOptions = useMemo(
    () =>
      cropGrowthStageOptions.find((item) => item.cropType === cropType)
        ?.growthStages ?? [],
    [cropType],
  );

  const shouldSelectGrowthStage = growthStageOptions.length > 0;
  console.log('growthStageOptions', growthStageOptions)

  const defaultLineQty = Math.max(1, Math.ceil(parseFloat(farmArea) || 1));

  const orderTotal = useMemo(() => {
    if (!catalog) return 0;
    return (
      selectionTotal(catalog.suggested, selectedSuggested) +
      selectionTotal(catalog.additional, selectedAdditional)
    );
  }, [catalog, selectedSuggested, selectedAdditional]);

  const buildAgencyQuery = useCallback(
    (lat: number, lon: number) => {
      const base = `latitude=${lat}&longitude=${lon}`;
      if (suggestionProductIds.length === 0) return base;
      return `${base}&suggestionProductIds=${suggestionProductIds.join(",")}`;
    },
    [suggestionProductIds],
  );

  const buildWardQuery = useCallback(() => {
    const ward = userProfile?.ward;
    const parts: string[] = [];
    if (ward) parts.push(`ward=${encodeURIComponent(ward)}`);
    if (suggestionProductIds.length > 0)
      parts.push(`suggestionProductIds=${suggestionProductIds.join(",")}`);
    return parts.join("&");
  }, [userProfile?.ward, suggestionProductIds]);

  const fetchFallbackAgencies = useCallback(async () => {
    try {
      // Dùng ward của user thay vì tọa độ cứng
      const wardQuery = buildWardQuery();
      const res = await fetch(`/api/farmer/agencies${wardQuery ? `?${wardQuery}` : ""}`);
      const data = await res.json();
      if (res.ok) {
        setAgencies(data);
      }
    } catch (e) {
      console.error("Failed to fetch fallback agencies:", e);
    } finally {
      setLoadingAgencies(false);
    }
  }, [buildWardQuery]);

  const fetchAgencies = useCallback(() => {
    setLoadingAgencies(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`/api/farmer/agencies?${buildAgencyQuery(latitude, longitude)}`);
            const data = await res.json();
            if (res.ok) {
              setAgencies(data);
            } else {
              await fetchFallbackAgencies();
            }
          } catch {
            await fetchFallbackAgencies();
          } finally {
            setLoadingAgencies(false);
          }
        },
        async () => {
          console.warn("Geolocation error, using fallback");
          await fetchFallbackAgencies();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      fetchFallbackAgencies();
    }
  }, [buildAgencyQuery, fetchFallbackAgencies]);

  const canOrderRole = ["FARMER", "AGENCY", "SUPER_AGENT"].includes(userProfile?.role ?? "");

  useEffect(() => {
    if (result?.status === "DONE" && canOrderRole) {
      queueMicrotask(fetchAgencies);
    }
  }, [fetchAgencies, result?.status, canOrderRole]);

  const loadAgencyCatalog = useCallback(
    async (agencyId: string) => {
      setLoadingCatalog(true);
      setOrderError("");
      try {
        const qs =
          suggestionProductIds.length > 0
            ? `?suggestionProductIds=${suggestionProductIds.join(",")}`
            : "";
        const res = await fetch(`/api/farmer/agencies/${agencyId}/catalog${qs}`);
        const data: AgencyCatalog = await res.json();
        if (!res.ok) {
          setCatalog(null);
          setSelectedSuggested(new Map());
          setSelectedAdditional(new Map());
          return;
        }
        setCatalog(data);

        const preselectId = preselectProductIdRef.current;
        const suggestedMap = new Map<string, number>();
        const additionalMap = new Map<string, number>();
        if (preselectId) {
          const sugItem = data.suggested.find((p) => p.productId === preselectId);
          if (sugItem) {
            suggestedMap.set(preselectId, defaultLineQty);
          } else {
            const addItem = data.additional.find((p) => p.productId === preselectId);
            if (addItem) {
              additionalMap.set(preselectId, defaultLineQty);
            }
          }
        } else {
          for (const item of data.suggested) {
            suggestedMap.set(item.productId, defaultLineQty);
          }
        }
        setSelectedSuggested(suggestedMap);
        setSelectedAdditional(additionalMap);
        preselectProductIdRef.current = null;
      } catch {
        setCatalog(null);
      } finally {
        setLoadingCatalog(false);
      }
    },
    [suggestionProductIds, defaultLineQty],
  );

  useEffect(() => {
    setSelectedSuggested((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const [key, val] of next) {
        if (val !== defaultLineQty) {
          next.set(key, defaultLineQty);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setSelectedAdditional((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const [key, val] of next) {
        if (val !== defaultLineQty) {
          next.set(key, defaultLineQty);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [defaultLineQty]);

  useEffect(() => {
    if (isOrderModalOpen && selectedAgency?.id) {
      queueMicrotask(() => loadAgencyCatalog(selectedAgency.id));
    }
  }, [isOrderModalOpen, selectedAgency?.id, loadAgencyCatalog]);

  const handleOpenOrderModal = (agency?: AgencyListItem) => {
    if (agencies.length === 0) return;
    setOrderError("");
    const defaultArea = userProfile?.area && userProfile.area > 0 ? String(userProfile.area) : "1.0";
    setFarmArea(defaultArea);
    preselectProductIdRef.current = null;
    setSelectedAgency(agency ?? agencies[0]);
    setIsOrderModalOpen(true);
  };

  const handleOpenOrderModalFromProduct = (product: { id: string }) => {
    if (agencies.length === 0) return;
    preselectProductIdRef.current = product.id;
    setOrderError("");
    const defaultArea = userProfile?.area && userProfile.area > 0 ? String(userProfile.area) : "1.0";
    setFarmArea(defaultArea);
    setSelectedAgency(agencies[0]);
    setIsOrderModalOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (!selectedAgency?.id || !catalog) {
      setOrderError("Vui lòng chọn đại lý");
      return;
    }
    const items = mergeSelections(
      catalog.suggested,
      catalog.additional,
      selectedSuggested,
      selectedAdditional,
    );
    if (items.length === 0) {
      setOrderError("Vui lòng chọn ít nhất một sản phẩm");
      return;
    }
    setOrderError("");
    setOrderSubmitting(true);
    try {
      const res = await fetch("/api/b2c/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyId: selectedAgency.id,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error === "INSUFFICIENT_STOCK"
            ? "Đại lý không đủ tồn kho sản phẩm này"
            : data.error === "AGENCY_NOT_LINKED_TO_USER"
              ? "Đại lý chưa được kích hoạt tài khoản. Vui lòng liên hệ hỗ trợ."
              : data.error ?? "Đặt hàng thất bại";
        throw new Error(msg);
      }
      setIsOrderModalOpen(false);
      toast.success(`Đặt hàng thành công! Mã đơn #${String(data.orderNumber).slice(-8).toUpperCase()}`);
    } catch (e: unknown) {
      setOrderError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setOrderSubmitting(false);
    }
  };

  useEffect(() => {
    fetchUserCrops();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUserProfile(d.user);
      })
      .catch(() => {});
  }, [fetchUserCrops]);

  // Kiểm tra trạng thái block từ localStorage mỗi giây
  useEffect(() => {
    const checkBlock = () => {
      const dataStr = localStorage.getItem("vfc_diagnose_rate_limit");
      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          const today = new Date().toDateString();
          
          // Reset nếu phát hiện sang ngày mới
          if (data.lastActiveDate && data.lastActiveDate !== today) {
            localStorage.removeItem("vfc_diagnose_rate_limit");
            setBlockedTimeRemaining(0);
            return;
          }

          const now = Date.now();
          if (data.blockedUntil && now < data.blockedUntil) {
            setBlockedTimeRemaining(Math.ceil((data.blockedUntil - now) / 1000));
          } else {
            setBlockedTimeRemaining(0);
          }
        } catch {
          // ignore
        }
      }
    };

    checkBlock();
    const interval = setInterval(checkBlock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setAnalyzeCountdown(20);
      interval = setInterval(() => {
        setAnalyzeCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    // Only take the first image
    const file = files[0];
    const url = URL.createObjectURL(file);
    setPreviews([url]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileRef.current?.files?.length) return;
    if (!cropType) {
      setError("Vui lòng chọn loại cây trồng trước khi phân tích");
      return;
    }
    if (shouldSelectGrowthStage && !growthStage) {
      setError("Vui lòng chọn giai đoạn sinh trưởng của cây");
      return;
    }

    // Đọc thông tin rate limit từ localStorage
    const now = new Date().getTime();
    const today = new Date().toDateString();
    const dataStr = localStorage.getItem("vfc_diagnose_rate_limit");
    let limitData = { triggers: [] as number[], blockedUntil: 0, penaltyCount: 0, lastActiveDate: today };
    
    if (dataStr) {
      try {
        const parsed = JSON.parse(dataStr);
        // Nếu phát hiện sang ngày mới, reset toàn bộ lịch sử vi phạm
        if (parsed.lastActiveDate && parsed.lastActiveDate !== today) {
          limitData = { triggers: [] as number[], blockedUntil: 0, penaltyCount: 0, lastActiveDate: today };
        } else {
          limitData = { ...parsed, lastActiveDate: today };
        }
      } catch {}
    } else {
      limitData.lastActiveDate = today;
    }

    // Lọc bỏ các trigger cũ hơn 1 phút
    const oneMinuteAgo = now - 60000;
    const activeTriggers = (limitData.triggers || []).filter((t: number) => t > oneMinuteAgo);
    
    activeTriggers.push(now);
    limitData.triggers = activeTriggers;

    // Nếu số lần trigger vượt quá 3 lần trong 1 phút
    if (activeTriggers.length > 3) {
      const nextPenaltyCount = (limitData.penaltyCount || 0) + 1;
      // Lũy tiến x10 lần thời gian phạt: Lần 1: 2m, Lần 2: 20m, Lần 3 trở đi: 200m (tối đa 200m)
      const penaltyMinutes = Math.min(200, 2 * Math.pow(10, nextPenaltyCount - 1));
      limitData.blockedUntil = now + penaltyMinutes * 60 * 1000;
      limitData.penaltyCount = nextPenaltyCount;
      
      localStorage.setItem("vfc_diagnose_rate_limit", JSON.stringify(limitData));
      setBlockedTimeRemaining(penaltyMinutes * 60);
      setError(`Bạn đang thao tác quá nhanh. Vui lòng đợi trong ${penaltyMinutes} phút.`);
      return;
    }

    localStorage.setItem("vfc_diagnose_rate_limit", JSON.stringify(limitData));

    setError("");
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("images", fileRef.current.files[0]); // Only send 1 image
    fd.append("cropType", cropType);
    if (growthStage) fd.append("growthStage", growthStage);

    try {
      const res = await fetch("/api/diagnoses", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Poll for result
      setResult({ id: data.id, status: "PROCESSING" });
      await pollResult(data.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  async function pollResult(id: string) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/diagnoses/${id}`);
      const data = await res.json();
      setResult(data);
      if (data.status !== "PROCESSING") return;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100 text-green-700">
          <Camera className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">
            Chẩn đoán bệnh cây
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Chụp hoặc chọn ảnh cây để AI phân tích
          </p>
        </div>
      </div>

      {blockedTimeRemaining > 0 ? (
        <div className="card flex flex-col items-center justify-center py-10 px-6 text-center border-2 border-red-200 bg-red-50/30 rounded-2xl shadow-sm animate-fade-in">
          <span className="text-4xl mb-3 animate-bounce">⚠️</span>
          <h2 className="text-lg sm:text-xl font-black text-red-800">
            Bạn đang thao tác quá nhanh!
          </h2>
          <p className="mt-2 text-sm text-neutral-600 max-w-md">
            Hệ thống phát hiện bạn đã yêu cầu chẩn đoán quá nhiều lần. Để đảm bảo hiệu năng hệ thống, vui lòng chờ:
          </p>
          <div className="mt-5 px-6 py-3 bg-red-100/80 border border-red-200 rounded-2xl text-2xl sm:text-3xl font-black text-red-700 tracking-wider shadow-inner">
            {Math.floor(blockedTimeRemaining / 60)}ph {(blockedTimeRemaining % 60)}s
          </div>
          <p className="mt-4 text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
            (Thời gian khóa tăng gấp 10 lần nếu tiếp tục gửi yêu cầu liên tục)
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card overflow-hidden p-0">
          <div className="border-b border-neutral-100 bg-gradient-to-br from-green-50 via-white to-emerald-50/70 px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm">
                <Leaf className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  Thông tin mẫu cây
                </h2>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <Sprout
                    className="h-4 w-4 text-green-600"
                    aria-hidden="true"
                  />
                  Cây trồng
                </label>
                <select
                  value={cropType}
                  onChange={(e) => {
                    setCropType(e.target.value);
                    setGrowthStage("");
                    setPreviews([]);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="input-field"
                >
                  <option value="">Chọn cây trồng</option>
                  {userCrops.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <Leaf
                    className="h-4 w-4 text-green-600"
                    aria-hidden="true"
                  />
                  Giai đoạn sinh trưởng
                </label>
                <select
                  value={growthStage}
                  onChange={(e) => setGrowthStage(e.target.value)}
                  disabled={!cropType || growthStageOptions.length === 0}
                  className="input-field disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
                >
                  <option value="">
                    {!cropType
                      ? "Chọn cây trồng trước"
                      : growthStageOptions.length === 0
                        ? "Chưa có dữ liệu giai đoạn"
                        : "Chọn giai đoạn"}
                  </option>
                  {growthStageOptions.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Image drop zone */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <Camera
                    className="h-4 w-4 text-green-600"
                    aria-hidden="true"
                  />
                  Ảnh triệu chứng
                </label>
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
                  1 ảnh
                </span>
              </div>
              <div
                onClick={() => growthStage && fileRef.current?.click()}
                className={`group flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-4 text-center transition ${
                  !growthStage
                    ? "cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-70"
                    : "cursor-pointer border-green-300 bg-green-50/60 hover:border-green-500 hover:bg-green-50"
                }`}
              >
                {previews.length > 0 ? (
                  <div className="flex w-full flex-col items-center gap-3">
                    {previews.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={p}
                        alt="Ảnh cây trồng đã chọn"
                        className="h-36 w-full max-w-sm rounded-xl object-cover shadow-sm ring-1 ring-neutral-200"
                      />
                    ))}
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm ring-1 ring-green-100">
                      <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                      Nhấn để đổi ảnh
                    </span>
                  </div>
                ) : (
                  <>
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                        growthStage
                          ? "bg-white text-green-600 shadow-sm"
                          : "bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      <ImagePlus className="h-7 w-7" aria-hidden="true" />
                    </span>
                    <span
                      className={`text-sm font-semibold ${!growthStage ? "text-neutral-400" : "text-green-800"}`}
                    >
                      {growthStage
                        ? "Nhấn để chụp hoặc chọn ảnh cây"
                        : "Vui lòng chọn cây trồng trước"}
                    </span>
                    <span className="max-w-sm text-xs leading-relaxed text-neutral-400">
                      Nên chụp rõ phần lá, thân, hoa hoặc trái đang có dấu
                      hiệu bất thường.
                    </span>
                  </>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {error && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3 text-base"
              disabled={
                loading ||
                !previews.length ||
                (shouldSelectGrowthStage && !growthStage)
              }
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang phân tích ({analyzeCountdown}s)...
                </div>
              ) : (
                <>
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Phân tích bệnh
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Result */}
      {result && (
        <div className="card flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Kết quả</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                result.status === "DONE"
                  ? "bg-green-100 text-green-700"
                  : result.status === "FAILED"
                    ? "bg-red-100 text-red-600"
                    : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {result.status === "PROCESSING"
                ? "Đang xử lý..."
                : result.status === "DONE"
                  ? "Hoàn tất"
                  : "Thất bại"}
            </span>
          </div>

          {result.status === "PROCESSING" && (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-green-50/30 rounded-2xl border border-green-100/50">
              <div className="relative mb-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
                <span className="absolute inset-0 flex items-center justify-center text-lg">
                  🔍
                </span>
              </div>
              <p className="text-base font-bold text-green-800 mb-1">
                Đang chẩn đoán hình ảnh cây trồng...
              </p>
              <p className="max-w-md text-xs text-neutral-500 leading-relaxed">
                Hệ thống đang quét triệu chứng qua AI và đối chiếu danh mục sản
                phẩm của VFC. Quá trình này mất khoảng 5 - 10 giây, vui lòng
                không tắt trình duyệt.
              </p>
            </div>
          )}

          {result.status === "DONE" && result.summary && (
            <>
              {/* Highlighted Disease Diagnostic Box */}
              <div className="rounded-2xl border-l-4 border-red-500 bg-red-50/40 p-4 sm:p-5 shadow-sm transition hover:shadow-md">
                {result.rawAiResponse?.disease &&
                  (() => {
                    const diseaseStr = result.rawAiResponse.disease;
                    const openParenIdx = diseaseStr.indexOf("(");
                    let main = diseaseStr;
                    let details = "";

                    if (openParenIdx !== -1) {
                      main = diseaseStr.slice(0, openParenIdx).trim();
                      details = diseaseStr.slice(openParenIdx).trim();
                    } else {
                      const dashIdx = diseaseStr.indexOf(" - ");
                      if (dashIdx !== -1) {
                        main = diseaseStr.slice(0, dashIdx).trim();
                        details = diseaseStr.slice(dashIdx + 3).trim();
                      }
                    }

                    return (
                      <div className="mb-2">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                          Kết quả Chẩn đoán bệnh
                        </span>
                        <h2 className="mt-1 text-xl sm:text-2xl font-black text-red-800 leading-tight">
                          {main}
                        </h2>
                        {details && (
                          <p className="mt-1.5 text-xs sm:text-sm text-neutral-600 font-medium italic leading-relaxed">
                            {details}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                {result.rawAiResponse?.severity && (
                  <p className="text-sm font-bold text-neutral-700">
                    Mức độ nghiêm trọng:{" "}
                    <span className="font-bold text-red-600 px-2 py-0.5">
                      {result.rawAiResponse.severity}
                    </span>
                  </p>
                )}
                <div className="mt-4 border-t border-neutral-200/60 pt-3">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Hướng xử lý đề xuất:
                  </p>
                  <p className="mt-1 text-sm text-neutral-600 leading-relaxed font-medium">
                    {result.summary}
                  </p>
                </div>
              </div>

              {( (result.suggestions && result.suggestions.length > 0) || result.rawAiResponse?.vfcSolutionText ) && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 text-base shadow-sm">
                      ✨
                    </span>
                    <h3 className="text-lg font-bold text-green-800">
                      Giải pháp VFC
                    </h3>
                  </div>

                  {result.rawAiResponse?.solutionSets && result.rawAiResponse.solutionSets.length > 0 ? (
                    <div className="flex flex-col gap-6">
                      {result.rawAiResponse.solutionSets.map((set, idx) => {
                        const isBestCombo = idx === 0; // Combo đầu tiên là tối ưu nhất
                        const matchedSuggestions = result.suggestions?.filter(s => 
                          s.product && set.products.some((pName: string) => 
                            s.product!.name.toLowerCase().includes(pName.toLowerCase()) || 
                            pName.toLowerCase().includes(s.product!.name.toLowerCase())
                          )
                        ) || [];
                        
                        if (matchedSuggestions.length === 0) return null;
                        
                        return (
                          <div 
                            key={idx} 
                            className={`relative rounded-2xl p-5 shadow-sm transition-all duration-300 overflow-hidden ${
                              isBestCombo
                                ? "border-2 border-green-500 bg-gradient-to-br from-green-50/60 via-white to-green-100/30 hover:shadow-lg hover:border-green-600 scale-[1.01]"
                                : "border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-md"
                            }`}
                          >
                            {isBestCombo && (
                              <div className="absolute top-0 right-0 rounded-bl-xl bg-green-600 px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm z-10">
                                Combo Đề Xuất Tối Ưu
                              </div>
                            )}

                            <div className="flex items-center gap-2 mb-4">
                              <h4 className={`font-black ${isBestCombo ? "text-green-800 text-lg sm:text-xl" : "text-neutral-800 text-base"}`}>
                                {set.name}
                              </h4>
                            </div>

                            <div className="flex flex-col gap-4 relative z-0">
                              {matchedSuggestions.map((s) => {
                                return (
                                  <div
                                    key={s.product?.id || s.rank}
                                    className="flex flex-col sm:flex-row gap-4 bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-neutral-100/80 shadow-sm"
                                  >
                                    <div className="mx-auto sm:mx-0 flex-shrink-0 h-24 w-24 rounded-xl bg-white border border-neutral-100 p-2 flex items-center justify-center shadow-sm">
                                      {s.product?.imageUrls?.[0] ? (
                                        <img
                                          src={s.product.imageUrls[0]}
                                          alt={s.product.name}
                                          className="max-h-full max-w-full object-contain"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-50 text-2xl">
                                          🧪
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-2 text-center sm:text-left">
                                      <div>
                                        <p className="font-bold text-neutral-800 text-base">
                                          {s.product?.name ?? "Sản phẩm"}
                                        </p>
                                        {s.product?.price ? (
                                          <p className="font-bold text-sm mt-1 text-green-700">
                                            Giá bán:{" "}
                                            <span className="text-neutral-700">
                                              {new Intl.NumberFormat("vi-VN", {
                                                style: "currency",
                                                currency: "VND",
                                              }).format(s.product.price)}
                                            </span>
                                          </p>
                                        ) : (
                                          <p className="text-xs text-neutral-400 mt-1">Liên hệ đại lý</p>
                                        )}
                                      </div>

                                      <div className="rounded-xl p-2.5 text-left bg-neutral-50 border border-neutral-100">
                                        <p className="text-sm leading-relaxed text-neutral-600">
                                          {s.reason}
                                        </p>
                                      </div>
                                      
                                      {s.product && !loadingAgencies && agencies.length > 0 && canOrderRole && (
                                        <div className="flex justify-center sm:justify-start mt-1">
                                          <button
                                            type="button"
                                            onClick={() => handleOpenOrderModalFromProduct(s.product!)}
                                            className="flex items-center gap-2 py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm hover:shadow transition duration-200"
                                          >
                                            🛒 Mua lẻ
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {result.suggestions?.map((s) => {
                        const isBestMatch = s.rank === 1;
                        return (
                          <div
                            key={s.rank}
                            className={`relative flex flex-col sm:flex-row gap-4 sm:gap-6 rounded-2xl p-5 shadow-sm transition-all duration-300 overflow-hidden ${
                              isBestMatch
                                ? "border-2 border-green-500 bg-gradient-to-br from-green-50/60 via-white to-green-100/30 hover:shadow-lg hover:border-green-600 scale-[1.01]"
                                : "border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-md"
                            }`}
                          >
                            <div
                              className={`mx-auto sm:mx-0 flex-shrink-0 rounded-xl bg-white border border-neutral-100 p-2 ${
                                isBestMatch ? "h-28 w-28" : "h-20 w-20"
                              } flex items-center justify-center shadow-sm`}
                            >
                              {s.product?.imageUrls?.[0] ? (
                                <img
                                  src={s.product.imageUrls[0]}
                                  alt={s.product.name}
                                  className="max-h-full max-w-full object-contain"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-50 text-2xl">
                                  🧪
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between gap-3 text-center sm:text-left">
                              <div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 flex-wrap justify-center sm:justify-start">
                                  <p
                                    className={`font-black text-neutral-800 ${isBestMatch ? "text-lg sm:text-xl" : "text-base"}`}
                                  >
                                    {s.product?.name ?? "Sản phẩm"}
                                  </p>
                                  {isBestMatch && (
                                    <span className="inline-block mx-auto sm:mx-0 rounded-full bg-green-200/60 px-2.5 py-0.5 text-[10px] font-black text-green-800 uppercase tracking-wider">
                                      Đề xuất tối ưu
                                    </span>
                                  )}
                                </div>

                                {s.product?.price ? (
                                  <p
                                    className={`font-black text-sm mt-1 ${isBestMatch ? "text-green-700" : "text-neutral-500"}`}
                                  >
                                    Giá bán:{" "}
                                    <span
                                      className={
                                        isBestMatch
                                          ? "text-lg text-green-600"
                                          : "text-neutral-700"
                                      }
                                    >
                                      {new Intl.NumberFormat("vi-VN", {
                                        style: "currency",
                                        currency: "VND",
                                      }).format(s.product.price)}
                                    </span>
                                  </p>
                                ) : (
                                  <p className="text-xs text-neutral-400 mt-1">
                                    Liên hệ đại lý
                                  </p>
                                )}
                              </div>

                              <div
                                className={`rounded-xl p-3 text-left ${isBestMatch ? "bg-green-100/40 border border-green-200/30" : "bg-neutral-50 border border-neutral-100"}`}
                              >
                                <p
                                  className={`text-sm leading-relaxed ${isBestMatch ? "font-semibold text-green-900" : "text-neutral-600"}`}
                                >
                                  {s.reason}
                                </p>
                              </div>

                              {s.product && !loadingAgencies && agencies.length > 0 && canOrderRole && (
                                <div className="flex justify-center sm:justify-start mt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenOrderModalFromProduct(s.product!)}
                                    className="flex items-center gap-2 py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition duration-200"
                                  >
                                    🛒 Đặt hàng ngay
                                  </button>
                                </div>
                              )}
                            </div>

                            {isBestMatch && (
                              <div className="absolute top-0 right-0 rounded-bl-xl bg-green-600 px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                                Phù hợp nhất
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Recommended Agencies Section — chỉ hiện cho FARMER/AGENCY/SUPER_AGENT */}
              {canOrderRole && (
              <div className="card flex flex-col gap-4 mt-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-base shadow-sm">
                    🏢
                  </span>
                  <h3 className="text-lg font-bold text-neutral-800">
                    Đại lý VFC {userProfile?.ward ? `tại ${userProfile.ward}` : "gần nhất"} hỗ trợ đặt hàng
                  </h3>
                </div>

                {loadingAgencies ? (
                  <div className="flex justify-center items-center py-6">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                  </div>
                ) : agencies.length === 0 ? (
                  <p className="text-neutral-500 text-sm text-center py-4">
                    Chưa tìm thấy đại lý bán hàng phù hợp.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {agencies.map((agency) => (
                      <div key={agency.id} className="relative flex flex-col justify-between border border-neutral-200 rounded-2xl p-5 bg-white hover:border-blue-400 hover:shadow-md transition duration-300">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-neutral-800 text-base">{agency.name}</h4>
                            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100/50 flex-shrink-0">
                              {agency.distance > 1000 
                                ? `${(agency.distance / 1000).toFixed(1)} km` 
                                : `${Math.round(agency.distance)} m`}
                            </span>
                          </div>
                          {agency.phone && (
                            <p className="text-xs text-neutral-500 font-medium">📞 SĐT: {agency.phone}</p>
                          )}
                          {agency.address && (
                            <p className="text-xs text-neutral-600 leading-relaxed mt-1">📍 {agency.address}</p>
                          )}
                        </div>
                        
                        <button 
                          onClick={() => handleOpenOrderModal(agency)}
                          className="mt-4 w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition duration-200"
                        >
                          🛒 Đặt hàng tại đại lý
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Order Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white border border-neutral-100 rounded-3xl p-6 shadow-2xl animate-scale-in relative">
            <button 
              onClick={() => setIsOrderModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition text-2xl font-bold"
            >
              &times;
            </button>
 
            <h3 className="text-xl font-black text-neutral-800 mb-4 flex items-center gap-2">
              🛒 Đặt hàng thuốc BVTV
            </h3>
 
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Đại lý tiếp nhận
                </label>
                {agencies.length === 0 ? (
                  <div className="text-xs text-red-500 py-2">
                    Không có đại lý nào còn đủ hàng cho sản phẩm đề xuất
                  </div>
                ) : (
                  <select
                    value={selectedAgency?.id || ""}
                    onChange={(e) => {
                      const agency = agencies.find((a) => a.id === e.target.value);
                      setSelectedAgency(agency || null);
                    }}
                    className="input-field border-neutral-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    {agencies.map((agency) => {
                      const distStr =
                        agency.distance > 1000
                          ? `${(agency.distance / 1000).toFixed(1)} km`
                          : `${Math.round(agency.distance)} m`;
                      return (
                        <option key={agency.id} value={agency.id}>
                          {agency.name} ({distStr}) — {agency.address || "Không rõ địa chỉ"}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Số lượng mặc định (mỗi SP mới chọn)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={farmArea}
                    onChange={(e) => setFarmArea(e.target.value)}
                    className="input-field border-neutral-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">ha</span>
                </div>
              </div>

              {loadingCatalog ? (
                <div className="flex justify-center py-6">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                </div>
              ) : (
                <>
                  <ProductMultiSelect
                    label="Sản phẩm đề xuất"
                    emptyText="Đại lý không còn hàng cho sản phẩm đề xuất"
                    products={catalog?.suggested ?? []}
                    selected={selectedSuggested}
                    onChange={setSelectedSuggested}
                    defaultQuantity={defaultLineQty}
                  />

                  <ProductMultiSelect
                    label="Mua thêm từ kho đại lý"
                    emptyText="Không có sản phẩm khác trong kho"
                    products={catalog?.additional ?? []}
                    selected={selectedAdditional}
                    onChange={setSelectedAdditional}
                    defaultQuantity={defaultLineQty}
                  />
                </>
              )}

              <div className="mt-2 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                <span className="block text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">
                  Tổng cộng tạm tính
                </span>
                <span className="text-2xl font-black text-blue-700 mt-1 block">
                  {orderTotal > 0
                    ? new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(orderTotal)
                    : "Chưa chọn sản phẩm"}
                </span>
              </div>

              {orderError && (
                <p className="text-sm text-red-600 font-medium">{orderError}</p>
              )}

              <div className="flex gap-3 mt-4">
                <button 
                  onClick={() => setIsOrderModalOpen(false)}
                  disabled={orderSubmitting}
                  className="flex-1 py-2.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold rounded-xl transition disabled:opacity-50"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleConfirmOrder}
                  disabled={
                    orderSubmitting ||
                    !selectedAgency ||
                    loadingCatalog ||
                    (selectedSuggested.size === 0 && selectedAdditional.size === 0)
                  }
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {orderSubmitting ? "Đang gửi..." : "Xác nhận"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
