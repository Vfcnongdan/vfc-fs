import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

/**
 * Service lấy danh sách sản phẩm được lưu cache cứng trên Memory / Redis (nếu deploy Vercel).
 * Vì danh mục 20 sản phẩm ít thay đổi, ta cache để giảm 100% chi phí query DB cho thao tác Read.
 */
export const getCachedProducts = unstable_cache(
  async () => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        slug: true,
        description: true,
        imageUrls: true,
        price: true,
        unit: true,
        detail: {
          select: {
            id: true,
            targetDiseases: true,
            usageInstruction: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return products.map((product) => ({
      ...product,
      price: Number(product.price),
    }));
  },
  ["vfc-products-list"], // Cache Key
  {
    revalidate: 86400, // Tái xác thực định kỳ (ví dụ: 1 ngày / 86400 giây)
    tags: ["products"], // Phục vụ cho On-demand Revalidation khi có thay đổi từ Admin
  }
);
