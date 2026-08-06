import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-oauth";
import { cookieOptions, saveRefreshTokenToDisk } from "@/lib/gmail-auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/consultoria/baltimore/gmail?error=missing_code", req.url),
    );
  }

  const tokens = await exchangeCodeForTokens(code);
  const response = NextResponse.redirect(
    new URL("/consultoria/baltimore/gmail", req.url),
  );

  response.cookies.set("g_access_token", tokens.access_token, {
    ...cookieOptions,
    maxAge: tokens.expires_in,
  });
  response.cookies.set(
    "g_expires_at",
    String(Date.now() + tokens.expires_in * 1000),
    cookieOptions,
  );
  if (tokens.refresh_token) {
    response.cookies.set("g_refresh_token", tokens.refresh_token, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
    await saveRefreshTokenToDisk(tokens.refresh_token);
  }

  return response;
}
