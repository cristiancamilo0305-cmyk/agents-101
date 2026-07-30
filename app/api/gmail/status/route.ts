import { NextResponse } from "next/server";
import { isConnected } from "@/lib/gmail-auth";

export async function GET() {
  return NextResponse.json({ connected: await isConnected() });
}
