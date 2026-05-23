import { getCachedProducts } from "@/services/productCacheService";
import InventoryClient from "./InventoryClient";

export const metadata = {
  title: "Quản lý kho hàng - Đại lý",
};

export default async function InventoryPage() {
  // Lấy sẵn danh sách 20 sản phẩm công ty từ Cache (0 hit database)
  const products = await getCachedProducts();

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý hàng hóa</h1>
        <p className="text-gray-500 text-sm">Quản lý số lượng tồn kho sản phẩm công ty</p>
      </header>

      <InventoryClient products={products} />
    </div>
  );
}
