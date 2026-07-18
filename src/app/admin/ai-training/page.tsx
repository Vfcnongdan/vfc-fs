"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { getPreviewUrl, eqStr } from "@/lib/utils";
import { cropGrowthStageOptions } from "@/lib/deseaseDetails";

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder,
  disabled,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.join(", ")
        : `Đã chọn ${selected.length}`;

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 px-3 py-2 text-left text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
        >
          <span className={`truncate ${selected.length === 0 ? "text-gray-400" : "text-gray-900"}`}>
            {displayText}
          </span>
          <svg
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && !disabled && (
          <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full border-b border-gray-100 px-3 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-gray-50"
              >
                Bỏ chọn tất cả
              </button>
            )}
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">Không có lựa chọn</div>
            ) : (
              options.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => toggle(opt)}
                    className="h-4 w-4 rounded border-gray-300 text-[#064E3B] focus:ring-[#064E3B]"
                  />
                  <span className="text-gray-700">{opt}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface PlanStageDisease {
  id: string;
  cropType: string;
  growthStage: string;
  pestDisease: string;
  detail: string;
  severityLevel: string;
  imageUrls: string[];
  description: string;
  vfcSolution: string;
  actionThreshold: string;
  pestDensity: string;
  createdAt: string;
  updatedAt: string;
}


export default function AITrainingPage() {
  const [data, setData] = useState<PlanStageDisease[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [crops, setCrops] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCrop, setSelectedCrop] = useState("");
  const [filterStage, setFilterStage] = useState<string[]>([]);
  const [filterPest, setFilterPest] = useState<string[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string[]>([]);

  // Danh sách lựa chọn cho bộ lọc, phụ thuộc vào cây trồng đang chọn
  const cropOption = useMemo(
    () => cropGrowthStageOptions.find((o) => eqStr(o.cropType, selectedCrop)),
    [selectedCrop],
  );
  const stageOptions = cropOption?.growthStages ?? [];
  const pestOptions = cropOption?.pestDiseases ?? [];
  const severityOptions = cropOption?.severityLevels ?? [];

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PlanStageDisease | null>(null);

  // Import
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"skip" | "override">("skip");
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    cropType: "",
    growthStage: "",
    pestDisease: "",
    detail: "",
    severityLevel: "",
    imageUrls: "", // We'll manage this as a newline/comma separated string in the textarea
    description: "",
    vfcSolution: "",
    actionThreshold: "",
    pestDensity: "",
  });

  const formCropOption = useMemo(
    () => cropGrowthStageOptions.find((o) => eqStr(o.cropType, formData.cropType)),
    [formData.cropType],
  );
  const formStageOptions = formCropOption?.growthStages ?? [];
  const formPestOptions = formCropOption?.pestDiseases ?? [];
  const formSeverityOptions = formCropOption?.severityLevels ?? [];

  useEffect(() => {
    // Fetch crops for dropdown
    fetch("/api/crops")
      .then((res) => res.json())
      .then((resData) => {
        setCrops((resData ?? []).map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch((err) => console.error("Failed to load crops:", err));
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedCrop) {
      setData([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }

    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        cropType: selectedCrop,
      });
      filterStage.forEach((v) => queryParams.append("growthStage", v));
      filterPest.forEach((v) => queryParams.append("pestDisease", v));
      filterSeverity.forEach((v) => queryParams.append("severityLevel", v));

      const res = await fetch(`/api/admin/ai-training?${queryParams.toString()}`);
      if (res.ok) {
        const resData = await res.json();
        setData(resData.data);
        setTotal(resData.total);
        setTotalPages(resData.totalPages);
      } else {
        toast.error("Lỗi khi tải dữ liệu");
      }
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }, [selectedCrop, filterStage, filterPest, filterSeverity, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    if (!selectedCrop) {
      toast.error("Vui lòng chọn Tên cây trồng để tìm kiếm");
      return;
    }
    setPage(1);
    fetchData();
  };

  const handleOpenCreateModal = () => {
    setSelectedRecord(null);
    setFormData({
      cropType: selectedCrop || "",
      growthStage: "",
      pestDisease: "",
      detail: "",
      severityLevel: "",
      imageUrls: "",
      description: "",
      vfcSolution: "",
      actionThreshold: "",
      pestDensity: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: PlanStageDisease) => {
    setSelectedRecord(record);
    setFormData({
      cropType: record.cropType,
      growthStage: record.growthStage,
      pestDisease: record.pestDisease,
      detail: record.detail,
      severityLevel: record.severityLevel,
      imageUrls: record.imageUrls.join("\n"),
      description: record.description,
      vfcSolution: record.vfcSolution,
      actionThreshold: record.actionThreshold,
      pestDensity: record.pestDensity,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bản ghi này?")) return;
    try {
      const res = await fetch(`/api/admin/ai-training/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Xóa thành công");
        fetchData();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Xóa thất bại");
      }
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleOpenImport = () => {
    setImportFile(null);
    setImportMode("skip");
    if (importInputRef.current) importInputRef.current.value = "";
    setIsImportOpen(true);
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Vui lòng chọn tệp CSV");
      return;
    }
    if (
      importMode === "override" &&
      !confirm(
        "Chế độ 'Ghi đè toàn bộ' sẽ XÓA tất cả dữ liệu hiện có trước khi import. Bạn có chắc chắn?",
      )
    ) {
      return;
    }

    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("mode", importMode);

      const res = await fetch("/api/admin/ai-training/import", {
        method: "POST",
        body: fd,
      });
      const resData = await res.json();

      if (res.ok) {
        toast.success(
          `Import xong: thêm ${resData.inserted} bản ghi` +
          (resData.deleted ? `, đã xóa ${resData.deleted}` : "") +
          (resData.skippedExisting ? `, bỏ ${resData.skippedExisting} trùng DB` : "") +
          (resData.skippedDuplicateInFile
            ? `, bỏ ${resData.skippedDuplicateInFile} trùng trong tệp`
            : "") +
          (resData.skippedInvalid ? `, bỏ ${resData.skippedInvalid} dòng lỗi` : ""),
          { duration: 6000 },
        );
        setIsImportOpen(false);
        fetchData();
      } else {
        toast.error(resData.error || "Import thất bại");
      }
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi import");
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cropType || !formData.growthStage || !formData.pestDisease || !formData.severityLevel || !formData.detail) {
      toast.error("Vui lòng nhập đủ các trường bắt buộc");
      return;
    }

    const payload = {
      ...formData,
      imageUrls: formData.imageUrls.split(/[\n,]/).map(u => u.trim()).filter(Boolean),
    };

    try {
      const isEdit = !!selectedRecord;
      const url = isEdit ? `/api/admin/ai-training/${selectedRecord.id}` : "/api/admin/ai-training";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEdit ? "Cập nhật thành công" : "Thêm mới thành công");
        setIsModalOpen(false);
        fetchData();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Thất bại");
      }
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Training (Reference Data)</h1>
          <p className="mt-1 text-sm text-gray-500">Quản lý dữ liệu đối chứng hỗ trợ AI chẩn đoán dịch hại cây trồng.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenImport}
            className="rounded-lg border border-[#064E3B] px-4 py-2 text-sm font-semibold text-[#064E3B] shadow-sm hover:bg-[#064E3B]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#064E3B]"
          >
            Import CSV
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="rounded-lg bg-[#064E3B] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#064E3B]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#064E3B]"
          >
            + Thêm bản ghi
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Cây trồng <span className="text-red-500">*</span></label>
            <select
              value={selectedCrop}
              onChange={(e) => {
                setSelectedCrop(e.target.value);
                setFilterStage([]);
                setFilterPest([]);
                setFilterSeverity([]);
                setPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
            >
              <option value="">-- Chọn cây trồng --</option>
              {crops.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <MultiSelectDropdown
            label="Giai đoạn"
            options={stageOptions}
            selected={filterStage}
            onChange={(v) => {
              setFilterStage(v);
              setPage(1);
            }}
            placeholder={selectedCrop ? "Tất cả giai đoạn" : "Chọn cây trồng trước"}
            disabled={!selectedCrop}
          />

          <MultiSelectDropdown
            label="Dịch hại"
            options={pestOptions}
            selected={filterPest}
            onChange={(v) => {
              setFilterPest(v);
              setPage(1);
            }}
            placeholder={selectedCrop ? "Tất cả dịch hại" : "Chọn cây trồng trước"}
            disabled={!selectedCrop}
          />

          <MultiSelectDropdown
            label="Cấp độ"
            options={severityOptions}
            selected={filterSeverity}
            onChange={(v) => {
              setFilterSeverity(v);
              setPage(1);
            }}
            placeholder={selectedCrop ? "Tất cả cấp độ" : "Chọn cây trồng trước"}
            disabled={!selectedCrop}
          />

          <div className="flex">
            <button
              onClick={handleSearch}
              className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Tìm kiếm
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cây trồng</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Giai đoạn</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dịch hại</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Chi tiết (Bệnh cụ thể)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cấp độ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Hình ảnh</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    {selectedCrop ? "Không tìm thấy dữ liệu phù hợp." : "Vui lòng chọn Cây trồng để xem dữ liệu."}
                  </td>
                </tr>
              ) : (
                data.map((item) => {
                  const missingFields: string[] = [];
                  if (!item.cropType) missingFields.push("Cây trồng");
                  if (!item.growthStage) missingFields.push("Giai đoạn");
                  if (!item.pestDisease) missingFields.push("Dịch hại");
                  if (!item.detail) missingFields.push("Chi tiết dịch hại");
                  if (!item.severityLevel) missingFields.push("Cấp độ");
                  if (!item.imageUrls || item.imageUrls.length === 0) missingFields.push("Hình ảnh");
                  if (!item.description) missingFields.push("Mô tả dấu hiệu");
                  if (!item.vfcSolution) missingFields.push("Giải pháp VFC");
                  if (!item.actionThreshold) missingFields.push("Ngưỡng hành động");
                  if (!item.pestDensity) missingFields.push("Mật độ dịch hại");
                  const hasMissing = missingFields.length > 0;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        <div className="flex items-center gap-2">
                          {hasMissing && (
                            <div className="group relative flex-shrink-0">
                              <span className="block h-2.5 w-2.5 rounded-full bg-yellow-400 cursor-default" />
                              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block">
                                <div className="rounded-md bg-gray-900 px-3 py-2 shadow-lg" style={{ minWidth: '180px' }}>
                                  <p className="mb-1 text-xs font-semibold text-yellow-400">Thiếu dữ liệu:</p>
                                  <ul className="space-y-0.5">
                                    {missingFields.map((f) => (
                                      <li key={f} className="text-xs text-gray-200">• {f}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                          {item.cropType}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.growthStage}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.pestDisease}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate" title={item.detail}>{item.detail}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                          {item.severityLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-[150px]">
                        {item.imageUrls && item.imageUrls.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {item.imageUrls.map((url, idx) => (
                              <div key={idx} className="group relative">
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block w-full truncate text-blue-600 hover:underline"
                                  title={url}
                                >
                                  {url}
                                </a>
                                {/* Tooltip Image Preview */}
                                <div className="hidden group-hover:block absolute z-50 left-0 bottom-full mb-2 p-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                                  <img src={getPreviewUrl(url)} alt="Preview" className="h-40 w-auto max-w-[300px] object-contain rounded" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Không có</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleOpenEditModal(item)} className="text-[#064E3B] hover:text-[#064E3B]/80 mr-4">Sửa</button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">Xóa</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Hiển thị <span className="font-medium">{(page - 1) * 20 + 1}</span> đến <span className="font-medium">{Math.min(page * 20, total)}</span> trong <span className="font-medium">{total}</span> kết quả
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span>Trước</span>
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span>Sau</span>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">{selectedRecord ? "Cập nhật bản ghi" : "Thêm bản ghi mới"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Cây trồng *</label>
                  <select
                    required
                    value={formData.cropType}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        cropType: e.target.value,
                        growthStage: "",
                        pestDisease: "",
                        severityLevel: "",
                      });
                    }}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
                  >
                    <option value="">-- Chọn cây trồng --</option>
                    {crops.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Giai đoạn *</label>
                  <select
                    required
                    value={formData.growthStage}
                    onChange={(e) => setFormData({ ...formData, growthStage: e.target.value })}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
                    disabled={!formData.cropType}
                  >
                    <option value="">-- Chọn giai đoạn --</option>
                    {formStageOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Dịch hại (Nhóm) *</label>
                  <select
                    required
                    value={formData.pestDisease}
                    onChange={(e) => setFormData({ ...formData, pestDisease: e.target.value })}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
                    disabled={!formData.cropType}
                  >
                    <option value="">-- Chọn dịch hại --</option>
                    {formPestOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Cấp độ *</label>
                  <select
                    required
                    value={formData.severityLevel}
                    onChange={(e) => setFormData({ ...formData, severityLevel: e.target.value })}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
                    disabled={!formData.cropType}
                  >
                    <option value="">-- Chọn cấp độ --</option>
                    {formSeverityOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Chi tiết dịch hại (Tên bệnh/sâu cụ thể) *</label>
                <input
                  required
                  type="text"
                  placeholder="VD: Thán thư, Sâu cuốn lá"
                  value={formData.detail}
                  onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Hình ảnh (URL, mỗi link 1 dòng)</label>
                <textarea
                  rows={2}
                  value={formData.imageUrls}
                  onChange={(e) => setFormData({ ...formData, imageUrls: e.target.value })}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Mô tả dấu hiệu</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Giải pháp VFC</label>
                <textarea
                  rows={2}
                  value={formData.vfcSolution}
                  onChange={(e) => setFormData({ ...formData, vfcSolution: e.target.value })}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Ngưỡng hành động (Action Threshold)</label>
                  <input
                    type="text"
                    value={formData.actionThreshold}
                    onChange={(e) => setFormData({ ...formData, actionThreshold: e.target.value })}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Mật độ dịch hại (Pest Density)</label>
                  <input
                    type="text"
                    value={formData.pestDensity}
                    onChange={(e) => setFormData({ ...formData, pestDensity: e.target.value })}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#064E3B] focus:outline-none focus:ring-1 focus:ring-[#064E3B]"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#064E3B] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#064E3B]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#064E3B]"
                >
                  {selectedRecord ? "Lưu thay đổi" : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Import dữ liệu từ CSV</h2>
              <button
                onClick={() => setIsImportOpen(false)}
                className="text-gray-400 hover:text-gray-500"
                disabled={importing}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Tệp CSV</label>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#064E3B] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#064E3B]/90"
                />
                <p className="text-xs text-gray-500">
                  Cột theo thứ tự: Cây, Giai đoạn, Dịch hại, Chi tiết, Cấp độ, Hình ảnh, Thông tin mô tả,
                  Biện pháp phòng trừ, Ngưỡng phòng trừ, Mật số.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Chế độ import</label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
                  <input
                    type="radio"
                    name="importMode"
                    value="skip"
                    checked={importMode === "skip"}
                    onChange={() => setImportMode("skip")}
                    className="mt-1 h-4 w-4 text-[#064E3B] focus:ring-[#064E3B]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Bỏ qua trùng lặp</span>
                    <span className="block text-xs text-gray-500">
                      Giữ nguyên dữ liệu hiện có, chỉ thêm bản ghi mới. Loại các dòng trùng (Cây +
                      Giai đoạn + Dịch hại + Chi tiết + Cấp độ).
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
                  <input
                    type="radio"
                    name="importMode"
                    value="override"
                    checked={importMode === "override"}
                    onChange={() => setImportMode("override")}
                    className="mt-1 h-4 w-4 text-[#064E3B] focus:ring-[#064E3B]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-red-600">Ghi đè toàn bộ</span>
                    <span className="block text-xs text-gray-500">
                      Xóa tất cả dữ liệu hiện có rồi nạp lại từ tệp CSV. Thao tác không thể hoàn tác.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  disabled={importing}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || !importFile}
                  className="rounded-md bg-[#064E3B] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#064E3B]/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importing ? "Đang import..." : "Bắt đầu import"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
