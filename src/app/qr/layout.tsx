import { FarmerHeader } from "@/components/FarmerHeader";

export default function QrLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <FarmerHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 flex flex-col">
        {children}
      </main>
    </div>
  );
}
