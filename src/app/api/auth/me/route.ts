import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    const response = NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { farmer: { select: { area: true, ward: true, province: true } } },
  });

  if (!user || user.sessionToken !== session.sessionId) {
    const response = NextResponse.json(
      {
        error: "UNAUTHORIZED",
        debug: {
          dbToken: user?.sessionToken?.slice(0, 8),
          jwtToken: session.sessionId?.slice(0, 8),
        },
      },
      { status: 401 },
    );
    response.cookies.delete(COOKIE_NAME);
    return response;
  }


  return Response.json({
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      area: user.farmer?.area,
      ward: user.farmer?.ward ?? null,
      province: user.farmer?.province ?? null,
    },
  });
}
