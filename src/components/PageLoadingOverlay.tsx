type PageLoadingOverlayProps = {
  message?: string;
};

export default function PageLoadingOverlay({
  message = "Đang kiểm tra...",
}: PageLoadingOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0C4A3F]/75 backdrop-blur-[2px]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-[#FFD680]"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm font-medium text-white/90">{message}</p>
      </div>
    </div>
  );
}
