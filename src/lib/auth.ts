import * as jose from "jose";
export const Role = {
  FARMER: "FARMER",
  SALE: "SALE",
  ADMIN: "ADMIN",
  AGENCY: "AGENCY",
  SUPER_AGENT: "SUPER_AGENT",
  MDO: "MDO",
  SE: "SE",
  BGD: "BGD",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const JWT_EXPIRES = "60d";

export type SessionPayload = {
  sub: string;       // userId
  phone: string;
  role: Role;
  sessionId?: string;
  iat?: number;
  exp?: number;
};

export async function signToken(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = "vfc_token";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 60, // 60 days
  path: "/",
};
