import { prisma } from "@/lib/prisma";

export interface AgencyWithDistance {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  taxCode: string | null;
  salesman: string | null;
  area: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  wardProvince: string | null;
  distance: number; // Khoảng cách tính bằng mét
}

/**
 * Lấy danh sách 2 đến 5 agency gần nhất trong bán kính 10km.
 * Nếu không có đủ, trả về 2 agency gần nhất bất kể khoảng cách.
 * 
 * @param lat Vĩ độ của vị trí hiện tại
 * @param lon Kinh độ của vị trí hiện tại
 */
export async function getNearestAgencies(lat: number, lon: number): Promise<AgencyWithDistance[]> {
  // Query 5 agency gần nhất bằng Postgres EarthDistance
  const rawAgencies = await prisma.$queryRaw<any[]>`
    SELECT id, code, name, phone, address, latitude, longitude, tax_code, salesman, area, ward_province,
      earth_distance(ll_to_earth(${lat}, ${lon}), ll_to_earth(latitude, longitude)) as distance
    FROM agencies
    WHERE latitude <> 0 AND longitude <> 0
    ORDER BY distance ASC
    LIMIT 5
  `;

  const agencies: AgencyWithDistance[] = rawAgencies.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    taxCode: row.tax_code,
    salesman: row.salesman,
    area: row.area,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    wardProvince: row.ward_province,
    distance: Number(row.distance),
  }));

  if (agencies.length === 0) {
    return [];
  }

  // Bán kính 10km = 10.000 mét
  const RADIUS_M = 10000;

  // Nếu agency thứ 2 gần nhất vượt quá 10km, hoặc danh sách có ít hơn 2 phần tử,
  // trả về tối đa 2 agency gần nhất (bất kể khoảng cách).
  if (agencies.length < 2 || agencies[1].distance > RADIUS_M) {
    return agencies.slice(0, 2);
  }

  // Ngược lại, trả về tất cả agency trong top 5 nằm trong bán kính 10km (chắc chắn >= 2 agency)
  return agencies.filter((a) => a.distance <= RADIUS_M);
}
