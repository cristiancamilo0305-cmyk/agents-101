const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  messageIdHeader: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
};

export async function listUnreadMessages(
  accessToken: string,
  max = 15,
): Promise<GmailMessageSummary[]> {
  return searchMessages(accessToken, "is:unread in:inbox", max);
}

/** Búsqueda genérica de Gmail (cualquier query, no solo no leídos/inbox). */
export async function searchMessages(
  accessToken: string,
  query: string,
  max = 15,
): Promise<GmailMessageSummary[]> {
  const listRes = await fetch(
    `${BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${max}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${await listRes.text()}`);
  const { messages } = (await listRes.json()) as { messages?: { id: string }[] };
  if (!messages?.length) return [];

  // Gmail rechaza con 429 si se mandan muchas peticiones concurrentes
  // para el mismo usuario, así que se procesan una por una.
  const results: GmailMessageSummary[] = [];
  for (const { id } of messages) {
    const res = await fetch(
      `${BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) continue;

    const data = await res.json();
    const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
    const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";
    results.push({
      id,
      threadId: data.threadId as string,
      messageIdHeader: get("Message-ID"),
      from: get("From"),
      subject: get("Subject"),
      snippet: data.snippet as string,
      date: get("Date"),
    });
  }
  return results;
}

type GmailApiPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailApiPart[];
};

type GmailApiMessage = {
  id: string;
  threadId: string;
  snippet: string;
  payload?: { headers?: { name: string; value: string }[] } & GmailApiPart;
};

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function decodeBase64UrlToBuffer(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function extractPlainTextBody(part: GmailApiPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  if (part.parts) {
    for (const child of part.parts) {
      const text = extractPlainTextBody(child);
      if (text) return text;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
  }
  return "";
}

export type GmailAttachmentRef = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
};

/** Junta adjuntos reales y también imágenes incrustadas en el cuerpo (mismo mecanismo en la API de Gmail). */
function extractAttachments(part: GmailApiPart | undefined): GmailAttachmentRef[] {
  if (!part) return [];
  const found: GmailAttachmentRef[] = [];
  if (part.body?.attachmentId && (part.filename || part.mimeType?.startsWith("image/"))) {
    found.push({
      attachmentId: part.body.attachmentId,
      filename: part.filename || "imagen-incrustada",
      mimeType: part.mimeType ?? "application/octet-stream",
      size: part.body.size ?? 0,
    });
  }
  if (part.parts) {
    for (const child of part.parts) found.push(...extractAttachments(child));
  }
  return found;
}

/** Cuerpo completo en texto plano de un mensaje (para cuando el snippet corto no alcanza). */
export async function getMessageBody(accessToken: string, messageId: string): Promise<string> {
  const res = await fetch(`${BASE}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail message fetch failed: ${await res.text()}`);
  const data = (await res.json()) as GmailApiMessage;
  return extractPlainTextBody(data.payload).slice(0, 6000);
}

/** Cuerpo completo + lista de adjuntos/imágenes incrustadas de un mensaje, en una sola llamada. */
export async function getMessageWithAttachments(
  accessToken: string,
  messageId: string,
): Promise<{ bodyText: string; attachments: GmailAttachmentRef[] }> {
  const res = await fetch(`${BASE}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail message fetch failed: ${await res.text()}`);
  const data = (await res.json()) as GmailApiMessage;
  return {
    bodyText: extractPlainTextBody(data.payload).slice(0, 6000),
    attachments: extractAttachments(data.payload),
  };
}

/** Descarga el contenido binario de un adjunto (o imagen incrustada) por su attachmentId. */
export async function getAttachmentBytes(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const res = await fetch(`${BASE}/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail attachment fetch failed: ${await res.text()}`);
  const { data } = (await res.json()) as { data: string };
  return decodeBase64UrlToBuffer(data);
}

/** To/Cc del mensaje original — para poder responder copiando a todos los que ya estaban en el correo. */
export async function getRecipients(
  accessToken: string,
  messageId: string,
): Promise<{ to: string; cc: string }> {
  const res = await fetch(
    `${BASE}/messages/${messageId}?format=metadata&metadataHeaders=To&metadataHeaders=Cc`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Gmail message fetch failed: ${await res.text()}`);
  const data = await res.json();
  const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
  const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";
  return { to: get("To"), cc: get("Cc") };
}

/** Correo de la cuenta de Gmail conectada (para excluirla de los destinatarios en copia). */
export async function getMyEmailAddress(accessToken: string): Promise<string> {
  const res = await fetch(`${BASE}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail profile fetch failed: ${await res.text()}`);
  const data = (await res.json()) as { emailAddress: string };
  return data.emailAddress;
}

/** true si ya hay un borrador en ese hilo (para no crear otro duplicado en corridas repetidas del triaje). */
export async function threadHasDraft(accessToken: string, threadId: string): Promise<boolean> {
  const res = await fetch(`${BASE}/threads/${threadId}?format=minimal`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail thread fetch failed: ${await res.text()}`);
  const data = (await res.json()) as { messages?: { labelIds?: string[] }[] };
  return (data.messages ?? []).some((m) => m.labelIds?.includes("DRAFT"));
}

/** Todos los mensajes de una cadena (para buscar menciones/referencias en correos previos del hilo). */
export async function getThreadMessages(
  accessToken: string,
  threadId: string,
): Promise<GmailMessageSummary[]> {
  const res = await fetch(
    `${BASE}/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Gmail thread fetch failed: ${await res.text()}`);
  const data = (await res.json()) as { messages?: GmailApiMessage[] };

  return (data.messages ?? []).map((m) => {
    const headers = m.payload?.headers ?? [];
    const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";
    return {
      id: m.id,
      threadId: m.threadId,
      messageIdHeader: get("Message-ID"),
      from: get("From"),
      subject: get("Subject"),
      snippet: m.snippet,
      date: get("Date"),
    };
  });
}

export function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader.trim();
}

/** Extrae todas las direcciones de un header To/Cc con varios destinatarios separados por coma. */
export function extractAllEmails(header: string): string[] {
  return header
    .split(",")
    .map((part) => extractEmail(part.trim()))
    .filter((email) => /\S+@\S+/.test(email));
}

/** Crea un borrador de respuesta en el hilo original. Nunca lo envía. */
export async function createReplyDraft(
  accessToken: string,
  original: Pick<GmailMessageSummary, "threadId" | "messageIdHeader" | "from" | "subject">,
  body: string,
  cc?: string[],
  contentType: "text/plain" | "text/html" = "text/plain",
): Promise<{ id: string }> {
  const to = extractEmail(original.from);
  const subject = /^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`;
  const ccList = [...new Set(cc)].filter((email) => email.toLowerCase() !== to.toLowerCase());

  const lines = [
    `To: ${to}`,
    ccList.length > 0 ? `Cc: ${ccList.join(", ")}` : null,
    `Subject: ${subject}`,
    original.messageIdHeader ? `In-Reply-To: ${original.messageIdHeader}` : null,
    original.messageIdHeader ? `References: ${original.messageIdHeader}` : null,
    `Content-Type: ${contentType}; charset=utf-8`,
    "MIME-Version: 1.0",
    "",
    body,
  ]
    .filter((line) => line !== null)
    .join("\r\n");

  const raw = Buffer.from(lines, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(`${BASE}/drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: { raw, threadId: original.threadId },
    }),
  });
  if (!res.ok) throw new Error(`Gmail draft creation failed: ${await res.text()}`);
  return res.json();
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
