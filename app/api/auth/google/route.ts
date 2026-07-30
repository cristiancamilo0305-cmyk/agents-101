import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-oauth";

export async function GET() {
  return NextResponse.redirect(getGoogleAuthUrl());
}
