import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RequestUser = {
  id: string;
  phone: string;
  role: Role;
};

/**
 * Extract user injected by middleware from request headers.
 * Returns null only if middleware was bypassed (should not happen in practice).
 */
export async function getRequestUser(request: NextRequest): Promise<RequestUser | null> {
  const id = request.headers.get("x-user-id");
  const phone = request.headers.get("x-user-phone");
  const role = request.headers.get("x-user-role") as Role | null;
  const sessionId = request.headers.get("x-user-session");

  if (!id || !phone || !role) return null;

  if (sessionId) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive || user.sessionToken !== sessionId) return null;
  }

  return { id, phone, role };
}

export function requireRole(user: RequestUser, ...roles: Role[]): boolean {
  return roles.includes(user.role);
}

export function apiError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return Response.json(data, { status });
}
