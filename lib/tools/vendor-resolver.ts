import { extractEmail, getThreadMessages, searchMessages, type GmailMessageSummary } from "@/lib/gmail";
import type { SapRow } from "@/lib/tools/sap-data";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Nombres comerciales que no comparten ni una palabra con la raz\u00f3n social registrada en SAP,
 * as\u00ed que ning\u00fan cruce por texto (declarado, remitente, menci\u00f3n en hilo) los conecta solo. Se
 * mapean a mano seg\u00fan se van confirmando con Cristian.
 */
const VENDOR_ALIASES: Record<string, string> = {
  "razar engineering solutions": "ALBERTO ISAAC RAMIREZ SANCHEZ",
  razar: "ALBERTO ISAAC RAMIREZ SANCHEZ",
};

/** Si el nombre (o el que ya se resolvi\u00f3) tiene un alias conocido, devuelve la raz\u00f3n social real de SAP. */
export function resolveKnownAlias(name: string | null): string | null {
  if (!name) return null;
  return VENDOR_ALIASES[normalize(name).trim()] ?? null;
}

/**
 * Quita direcciones postales, montos y fechas para que sus números no se confundan con
 * facturas: "CP 65580", "#2005", "Av. X", "Col. Y", "$4,672.32", "7/30/2026", años sueltos.
 */
function stripNoise(text: string): string {
  return text
    .replace(/\bC\.?P\.?\s*\d+/gi, " ")
    .replace(/#\s?\d+/g, " ")
    .replace(/\bAv\.[^,.]*/gi, " ")
    .replace(/\bCol\.[^,.]*/gi, " ")
    .replace(/\$\s?[\d,]+(\.\d+)?/g, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ");
}

function extractCandidateReferences(text: string): string[] {
  // Tokens tipo código de factura: letras opcionales + dígitos, ej. "NL0311474", "FAC-20738", "T 25834".
  const matches = stripNoise(text).match(/\b[A-Za-z]{0,4}[-\s]?\d{3,}\b/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/\s+/g, "").toUpperCase()))];
}

function buildReferenceIndex(rows: SapRow[]): Map<string, SapRow[]> {
  const index = new Map<string, SapRow[]>();
  for (const row of rows) {
    if (!row.reference) continue;
    const key = row.reference.replace(/\s+/g, "").toUpperCase();
    const list = index.get(key);
    if (list) list.push(row);
    else index.set(key, [row]);
  }
  return index;
}

/** Solo los dígitos, sin ceros a la izquierda — mismo criterio que en statement-reconciliation.ts,
 *  para cuando la factura declarada trae un prefijo de letras distinto al capturado en SAP. */
function digitsOnly(text: string): string {
  const digits = text.replace(/\D/g, "").replace(/^0+/, "");
  return digits || "0";
}

function buildDigitsIndex(rows: SapRow[]): Map<string, SapRow[]> {
  const index = new Map<string, SapRow[]>();
  for (const row of rows) {
    if (!row.reference) continue;
    const key = digitsOnly(row.reference);
    if (key.length < 3) continue;
    const list = index.get(key);
    if (list) list.push(row);
    else index.set(key, [row]);
  }
  return index;
}

function resolveVendorFromMessages(messages: GmailMessageSummary[], rows: SapRow[]): string | null {
  const referenceIndex = buildReferenceIndex(rows);
  const vendorCounts = new Map<string, number>();

  for (const msg of messages) {
    const candidates = extractCandidateReferences(`${msg.subject} ${msg.snippet}`);
    for (const candidate of candidates) {
      const matches = referenceIndex.get(candidate);
      if (!matches) continue;
      for (const match of matches) {
        vendorCounts.set(match.vendorName, (vendorCounts.get(match.vendorName) ?? 0) + 1);
      }
    }
  }

  if (vendorCounts.size === 0) return null;
  return [...vendorCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Igual que resolveVendorFromMessages pero a partir de una lista de números de factura ya
 * conocidos (ej. extraídos de un estado de cuenta), sin tener que volver a extraerlos de texto libre.
 */
export function resolveVendorFromReferenceList(references: string[], rows: SapRow[]): string | null {
  const referenceIndex = buildReferenceIndex(rows);
  const digitsIndex = buildDigitsIndex(rows);
  const vendorCounts = new Map<string, number>();

  for (const reference of references) {
    const key = reference.replace(/\s+/g, "").toUpperCase();
    // Se prueba primero la referencia exacta; solo si no hay nada se recurre a solo-dígitos (el
    // mismo proveedor puede capturar sus facturas en SAP con o sin el prefijo de letras).
    const matches = referenceIndex.get(key) ?? digitsIndex.get(digitsOnly(reference));
    if (!matches) continue;
    for (const match of matches) {
      vendorCounts.set(match.vendorName, (vendorCounts.get(match.vendorName) ?? 0) + 1);
    }
  }

  if (vendorCounts.size === 0) return null;
  return [...vendorCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Identifica al proveedor por número de orden de compra (PO) — útil cuando el correo trae la PO
 * del caso (ej. en el asunto) pero el nombre del proveedor no calza directo con SAP.
 */
export function resolveVendorFromPurchaseOrder(purchaseOrder: string, rows: SapRow[]): string | null {
  const key = purchaseOrder.replace(/\s+/g, "").toUpperCase();
  const vendorCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.purchaseOrder) continue;
    if (row.purchaseOrder.replace(/\s+/g, "").toUpperCase() !== key) continue;
    vendorCounts.set(row.vendorName, (vendorCounts.get(row.vendorName) ?? 0) + 1);
  }
  if (vendorCounts.size === 0) return null;
  return [...vendorCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Cuando el proveedor no se encuentra por nombre (ej. el remitente escribe desde el dominio
 * de su empresa pero en SAP está registrado con otro nombre/razón social), busca en el
 * historial de correos de ese remitente qué números de factura ha mencionado antes y los
 * cruza contra las referencias de SAP para inferir el proveedor real.
 */
export async function resolveVendorFromSenderHistory(
  accessToken: string,
  senderFrom: string,
  rows: SapRow[],
): Promise<string | null> {
  const senderEmail = extractEmail(senderFrom);
  if (!senderEmail) return null;

  const history = await searchMessages(accessToken, `from:${senderEmail}`, 25);
  if (history.length === 0) return null;

  return resolveVendorFromMessages(history, rows);
}

/**
 * Cuando un correo interno (ej. de otro empleado de Baltimore) reenvía o responde sobre un
 * pago sin nombrar al proveedor, revisa los demás correos de la MISMA cadena por si en algún
 * mensaje anterior/posterior sí se menciona un número de factura que se pueda cruzar con SAP.
 */
export async function resolveVendorFromThreadReferences(
  accessToken: string,
  threadId: string,
  rows: SapRow[],
): Promise<string | null> {
  const messages = await getThreadMessages(accessToken, threadId);
  if (messages.length === 0) return null;

  return resolveVendorFromMessages(messages, rows);
}

/** Palabra distintiva de un nombre de proveedor (evita palabras genéricas tipo "SA", "DE", "CV", "MEXICO"). */
const GENERIC_WORDS = new Set([
  "SA",
  "DE",
  "CV",
  "S",
  "C",
  "V",
  "RL",
  "MEXICO",
  "COMPANY",
  "GRUPO",
  "INDUSTRIAL",
  "INDUSTRIALES",
  "SERVICIOS",
  "COMERCIALIZADORA",
]);

function distinctiveWord(vendorName: string): string | null {
  const words = normalize(vendorName)
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w.toUpperCase()));
  return words[0] ?? null;
}

function displayNameWords(fromHeader: string): string[] {
  const displayName = fromHeader.replace(/<[^>]*>/, "").replace(/["']/g, "");
  return normalize(displayName)
    .split(/[\s,]+/)
    .filter(Boolean);
}

/**
 * Revisa el texto de toda la cadena por si algún proveedor de SAP se menciona por nombre
 * directamente (ej. "el pago fue a Fastenal"), sin depender de números de factura. Excluye
 * los nombres de quienes participan en el hilo, para no confundir "Hector" (remitente) con
 * un proveedor que por coincidencia también se llame Hector.
 */
export async function findVendorMentionInThread(
  accessToken: string,
  threadId: string,
  rows: SapRow[],
): Promise<string | null> {
  const messages = await getThreadMessages(accessToken, threadId);
  if (messages.length === 0) return null;

  const text = normalize(messages.map((m) => `${m.subject} ${m.snippet}`).join(" "));
  const participantWords = new Set(messages.flatMap((m) => displayNameWords(m.from)));
  const vendorNames = [...new Set(rows.map((r) => r.vendorName))];

  for (const vendorName of vendorNames) {
    const word = distinctiveWord(vendorName);
    if (!word || participantWords.has(word)) continue;
    if (new RegExp(`\\b${word}\\b`).test(text)) return vendorName;
  }
  return null;
}

/** Extrae montos con centavos mencionados en el texto (ej. "$4,672.32", "4672.32 USD"). */
export function extractAmountCandidates(text: string): number[] {
  const matches = text.match(/\$?\s?[\d,]+\.\d{2}/g) ?? [];
  return [...new Set(matches.map((m) => Number(m.replace(/[$,\s]/g, ""))))].filter(
    (n) => Number.isFinite(n) && n > 0,
  );
}
