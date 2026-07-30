import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/gmail-auth";
import { markAsRead } from "@/lib/gmail";

export async function POST(req: Request) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const { ids }: { ids: string[] } = await req.json();

  // Gmail rechaza con 429 si se mandan muchas peticiones concurrentes
  // para el mismo usuario, así que se procesan una por una.
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await markAsRead(accessToken, id);
    } catch {
      failed.push(id);
    }
  }

  return NextResponse.json({ ok: failed.length === 0, failed });
}
