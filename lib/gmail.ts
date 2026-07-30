const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailMessageSummary = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
};

export async function listUnreadMessages(
  accessToken: string,
  max = 15,
): Promise<GmailMessageSummary[]> {
  const listRes = await fetch(
    `${BASE}/messages?q=${encodeURIComponent("is:unread in:inbox")}&maxResults=${max}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${await listRes.text()}`);
  const { messages } = (await listRes.json()) as { messages?: { id: string }[] };
  if (!messages?.length) return [];

  return Promise.all(
    messages.map(async ({ id }) => {
      const res = await fetch(
        `${BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = await res.json();
      const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
      const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";
      return {
        id: data.id as string,
        from: get("From"),
        subject: get("Subject"),
        snippet: data.snippet as string,
        date: get("Date"),
      };
    }),
  );
}

export async function markAsRead(accessToken: string, messageId: string) {
  const res = await fetch(`${BASE}/messages/${messageId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
  if (!res.ok) throw new Error(`Gmail modify failed: ${await res.text()}`);
}
