import { cookies } from "next/headers";
import { refreshAccessToken } from "./google-oauth";

const ACCESS_COOKIE = "g_access_token";
const REFRESH_COOKIE = "g_refresh_token";
const EXPIRES_COOKIE = "g_expires_at";

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/" };

export async function getValidAccessToken(): Promise<string | null> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  const expiresAt = Number(store.get(EXPIRES_COOKIE)?.value ?? 0);
  const accessToken = store.get(ACCESS_COOKIE)?.value;

  if (accessToken && Date.now() < expiresAt) return accessToken;
  if (!refreshToken) return null;

  const refreshed = await refreshAccessToken(refreshToken);
  store.set(ACCESS_COOKIE, refreshed.access_token, cookieOptions);
  store.set(
    EXPIRES_COOKIE,
    String(Date.now() + refreshed.expires_in * 1000),
    cookieOptions,
  );
  return refreshed.access_token;
}

export async function isConnected(): Promise<boolean> {
  const store = await cookies();
  return Boolean(
    store.get(REFRESH_COOKIE)?.value || store.get(ACCESS_COOKIE)?.value,
  );
}

export { ACCESS_COOKIE, REFRESH_COOKIE, EXPIRES_COOKIE, cookieOptions };
