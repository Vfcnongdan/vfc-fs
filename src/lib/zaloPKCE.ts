import { randomBytes, createHash } from "crypto";

export function generateCodeVerifier(): string {
  // Zalo requires exactly 43 alphanumeric characters (a-zA-Z0-9)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(43);
  let result = "";
  for (let i = 0; i < 43; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const base64 = Buffer.from(hash).toString("base64url");
  return base64;
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

export function buildZaloAuthorizationUrl(
  codeChallenge: string,
  state: string
): string {
  const appId = process.env.ZALO_APP_ID;
  const redirectUri = process.env.ZALO_CALLBACK_URL;

  if (!appId || !redirectUri) {
    throw new Error("Missing ZALO_APP_ID or ZALO_CALLBACK_URL in environment");
  }

  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "oa",
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://oauth.zaloapp.com/v4/permission?${params.toString()}`;
}