import { cookies } from "next/headers";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { refreshAccessToken } from "./google-oauth";

const ACCESS_COOKIE = "g_access_token";
const REFRESH_COOKIE = "g_refresh_token";
const EXPIRES_COOKIE = "g_expires_at";

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/" };

// Respaldo del refresh token en disco (fuera de git, ver .gitignore) para que tareas
// programadas sin navegador (cron/launchd) puedan autenticarse igual que la sesión web.
const TOKEN_FILE = path.join(process.cwd(), "data", "google-refresh-token.json");

/** Best-effort: en Vercel el filesystem es de solo lectura, así que esto falla en producción sin romper el login web (que ya quedó guardado en cookie). */
export async function saveRefreshTokenToDisk(refreshToken: string) {
  try {
    await mkdir(path.dirname(TOKEN_FILE), { recursive: true });
    await writeFile(TOKEN_FILE, JSON.stringify({ refreshToken }), "utf-8");
  } catch (err) {
    console.warn("No se pudo guardar el refresh token en disco (normal en Vercel):", err);
  }
}

async function loadRefreshTokenFromDisk(): Promise<string | null> {
  try {
    const raw = await readFile(TOKEN_FILE, "utf-8");
    return (JSON.parse(raw).refreshToken as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const store = await cookies();
  const expiresAt = Number(store.get(EXPIRES_COOKIE)?.value ?? 0);
  const accessToken = store.get(ACCESS_COOKIE)?.value;

  if (accessToken && Date.now() < expiresAt) return accessToken;

  const refreshToken = store.get(REFRESH_COOKIE)?.value ?? (await loadRefreshTokenFromDisk());
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
