import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/gmail-auth";
import { listUnreadMessages } from "@/lib/gmail";
import { classifyEmails } from "@/lib/tools/email-classifier";

export async function POST() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const emails = await listUnreadMessages(accessToken, 50);
  const clasificaciones = await classifyEmails(emails);

  const results = emails.map((email) => ({
    ...email,
    ...clasificaciones.find((c) => c.id === email.id),
  }));

  return NextResponse.json({ results });
}
