import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/gmail-auth";
import {
  createReplyDraft,
  extractAllEmails,
  extractEmail,
  getAttachmentBytes,
  getMessageBody,
  getMessageWithAttachments,
  getMyEmailAddress,
  getRecipients,
  listUnreadMessages,
  threadHasDraft,
} from "@/lib/gmail";
import { classifyEmails, extractPaymentDetailsFromBody, hasImportantKeyword } from "@/lib/tools/email-classifier";
import {
  filterByVendor,
  formatPaymentSummaryEmail,
  formatPaymentSummaryEmailHtml,
  getInvoicesDueByFriday,
  getPaymentDetail,
  loadSapRows,
  resolveVendorByAmountAndDate,
  type SapRow,
} from "@/lib/tools/sap-data";
import { loadSatRows, type SatRow } from "@/lib/tools/sat-data";
import {
  extractAmountCandidates,
  findVendorMentionInThread,
  resolveVendorFromPurchaseOrder,
  resolveVendorFromReferenceList,
  resolveVendorFromSenderHistory,
  resolveVendorFromThreadReferences,
} from "@/lib/tools/vendor-resolver";
import { extractStatementInvoices, type AttachmentPayload } from "@/lib/tools/statement-extraction";
import {
  reconcileClaimedInvoices,
  formatStatementReconciliationEmail,
  formatStatementReconciliationEmailHtml,
  type InvoiceReconciliation,
} from "@/lib/tools/statement-reconciliation";
import type { GmailMessageSummary } from "@/lib/gmail";

async function resolvePayment(
  accessToken: string,
  email: GmailMessageSummary,
  proveedorSugerido: string | undefined,
  fechaPago: string,
  extraText: string,
  rows: SapRow[],
): Promise<{ proveedor: string; matches: SapRow[] } | null> {
  if (proveedorSugerido) {
    const matches = getPaymentDetail(rows, proveedorSugerido, fechaPago);
    if (matches.length > 0) return { proveedor: proveedorSugerido, matches };
  }

  // 1. Señal más confiable: si mencionan un monto exacto, cruzarlo contra los totales de esa fecha.
  const montos = extractAmountCandidates(`${email.subject} ${email.snippet} ${extraText}`);
  for (const monto of montos) {
    const porMonto = resolveVendorByAmountAndDate(rows, monto, fechaPago);
    if (porMonto) {
      const matches = getPaymentDetail(rows, porMonto, fechaPago);
      if (matches.length > 0) return { proveedor: porMonto, matches };
    }
  }

  // 2. ¿Lo menciona directamente algún correo de la misma cadena?
  const mencionado = await findVendorMentionInThread(accessToken, email.threadId, rows);
  if (mencionado) {
    const matches = getPaymentDetail(rows, mencionado, fechaPago);
    if (matches.length > 0) return { proveedor: mencionado, matches };
  }

  // 3. ¿Algún correo de la cadena menciona un número de factura que se pueda cruzar con SAP?
  const porReferenciaHilo = await resolveVendorFromThreadReferences(accessToken, email.threadId, rows);
  if (porReferenciaHilo) {
    const matches = getPaymentDetail(rows, porReferenciaHilo, fechaPago);
    if (matches.length > 0) return { proveedor: porReferenciaHilo, matches };
  }

  // 4. ¿El historial más amplio del remitente menciona facturas cruzables con SAP? Solo tiene
  //    sentido para contactos externos: el historial de un empleado interno de Baltimore mezcla
  //    correos sobre decenas de proveedores distintos y daría falsos positivos.
  if (!/@baltimoreaircoil\.com$/i.test(extractEmail(email.from))) {
    const porHistorialRemitente = await resolveVendorFromSenderHistory(accessToken, email.from, rows);
    if (porHistorialRemitente) {
      const matches = getPaymentDetail(rows, porHistorialRemitente, fechaPago);
      if (matches.length > 0) return { proveedor: porHistorialRemitente, matches };
    }
  }

  return null;
}

const ATTACHMENT_MIME_ALLOW = /^(application\/pdf|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml|text\/csv|image\/)/;

/** Próximo viernes (hoy incluido si ya es viernes), en formato YYYY-MM-DD. */
function nextFridayIso(): string {
  const d = new Date();
  const daysUntilFriday = (5 - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + daysUntilFriday);
  return d.toISOString().slice(0, 10);
}

/**
 * Descarga y analiza el estado de cuenta de un proveedor (adjunto Excel/PDF o imagen en el
 * cuerpo), lo concilia contra SAP y SAT, y prepara un borrador de respuesta con la tabla de
 * hallazgos, copiando a todos los que ya estaban en el correo. Nunca envía el borrador.
 */
async function analizarEstadoDeCuenta(
  accessToken: string,
  email: GmailMessageSummary,
  myEmail: string,
  getSapRows: () => Promise<SapRow[]>,
  getSatRows: () => Promise<SatRow[]>,
): Promise<{ borrador?: { id: string; preview: string }; conciliacion?: InvoiceReconciliation[] }> {
  // Evita re-analizar y duplicar el borrador si ya se generó uno en una corrida anterior del triaje.
  if (await threadHasDraft(accessToken, email.threadId)) return {};

  const { bodyText, attachments } = await getMessageWithAttachments(accessToken, email.id);

  const relevantRefs = attachments.filter((a) => ATTACHMENT_MIME_ALLOW.test(a.mimeType));
  const payloads: AttachmentPayload[] = [];
  for (const ref of relevantRefs) {
    const data = await getAttachmentBytes(accessToken, email.id, ref.attachmentId);
    payloads.push({ ...ref, data });
  }

  if (payloads.length === 0 && !bodyText.trim()) return {};

  const extraccion = await extractStatementInvoices(bodyText, payloads, email.subject);

  const [rows, satRows] = await Promise.all([getSapRows(), getSatRows()]);

  let vendorHint = extraccion.proveedorDeclarado ?? null;
  if (!vendorHint && extraccion.ordenCompraDeclarada) {
    vendorHint = resolveVendorFromPurchaseOrder(extraccion.ordenCompraDeclarada, rows);
  }
  if (!vendorHint && extraccion.facturas.length > 0) {
    vendorHint = resolveVendorFromReferenceList(
      extraccion.facturas.map((f) => f.numero),
      rows,
    );
  }
  if (!vendorHint) {
    vendorHint = await findVendorMentionInThread(accessToken, email.threadId, rows);
  }
  if (!vendorHint && !/@baltimoreaircoil\.com$/i.test(extractEmail(email.from))) {
    vendorHint = await resolveVendorFromSenderHistory(accessToken, email.from, rows);
  }

  let facturas = extraccion.facturas;
  if (facturas.length === 0) {
    // El proveedor pregunta por el pago sin citar facturas puntuales (ej. "no recibimos el pago,
    // confirmen la nueva fecha") — si de todos modos se pudo identificar el proveedor, se responde
    // solo con lo que corresponde al próximo viernes de pago (no todo el historial pendiente).
    if (!vendorHint) return {};
    const pendientes = getInvoicesDueByFriday(filterByVendor(rows, vendorHint), nextFridayIso());
    if (pendientes.length === 0) return {};
    facturas = pendientes.map((r) => ({ numero: r.reference, monto: r.totalAmount, moneda: r.currency }));
  }

  const conciliacion = reconcileClaimedInvoices(rows, satRows, vendorHint, facturas);
  const preview = formatStatementReconciliationEmail(vendorHint, conciliacion);
  const htmlBody = formatStatementReconciliationEmailHtml(vendorHint, conciliacion);

  const { to, cc } = await getRecipients(accessToken, email.id);
  const ccList = [...extractAllEmails(to), ...extractAllEmails(cc)].filter(
    (addr) => addr.toLowerCase() !== myEmail.toLowerCase(),
  );

  const draft = await createReplyDraft(accessToken, email, htmlBody, ccList, "text/html");
  return { borrador: { id: draft.id, preview }, conciliacion };
}

export async function POST() {
  const validToken = await getValidAccessToken();
  if (!validToken) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }
  const accessToken: string = validToken;

  const emails = await listUnreadMessages(accessToken, 50);
  const clasificaciones = await classifyEmails(emails);

  let sapRows: SapRow[] | null = null;
  async function getSapRows(): Promise<SapRow[]> {
    if (!sapRows) sapRows = (await loadSapRows()).rows;
    return sapRows;
  }
  let satRows: SatRow[] | null = null;
  async function getSatRows(): Promise<SatRow[]> {
    if (!satRows) satRows = (await loadSatRows()).rows;
    return satRows;
  }
  let myEmail: string | null = null;
  async function getMyEmail(): Promise<string> {
    if (myEmail) return myEmail;
    const resolved = await getMyEmailAddress(accessToken);
    myEmail = resolved;
    return resolved;
  }

  const results = await Promise.all(
    emails.map(async (email) => {
      const clasificacion = clasificaciones.find((c) => c.id === email.id);
      const importante = hasImportantKeyword(email);

      let borrador: { id: string; preview: string } | undefined;
      let conciliacion: InvoiceReconciliation[] | undefined;

      if (clasificacion?.categoria === "estado_cuenta_proveedor") {
        try {
          const resultado = await analizarEstadoDeCuenta(
            accessToken,
            email,
            await getMyEmail(),
            getSapRows,
            getSatRows,
          );
          borrador = resultado.borrador;
          conciliacion = resultado.conciliacion;
        } catch {
          // No bloquear el triaje si falla la lectura de adjuntos/SAP/SAT; el correo sigue en "requieren atención" sin borrador.
        }
      } else if (clasificacion?.necesita_detalle_pago && !(await threadHasDraft(accessToken, email.threadId))) {
        try {
          let proveedor = clasificacion.proveedor;
          let fechaPago = clasificacion.fecha_pago;
          let bodyText = "";

          // El snippet corto de Gmail a veces no alcanza (ej. avisos bancarios SPEI donde el
          // monto/fecha reales están más abajo en el cuerpo) — si falta la fecha, se reintenta
          // con el correo completo.
          if (!fechaPago) {
            bodyText = await getMessageBody(accessToken, email.id);
            const enriquecido = await extractPaymentDetailsFromBody(email, bodyText);
            proveedor = proveedor || enriquecido.proveedor;
            fechaPago = fechaPago || enriquecido.fecha_pago;
          }

          if (fechaPago) {
            const rows = await getSapRows();
            const resuelto = await resolvePayment(accessToken, email, proveedor, fechaPago, bodyText, rows);

            if (resuelto) {
              const preview = formatPaymentSummaryEmail(resuelto.proveedor, fechaPago, resuelto.matches);
              const htmlBody = formatPaymentSummaryEmailHtml(resuelto.proveedor, fechaPago, resuelto.matches);
              const draft = await createReplyDraft(accessToken, email, htmlBody, undefined, "text/html");
              borrador = { id: draft.id, preview };
            }
          }
        } catch {
          // No bloquear el triaje si falla la lectura de SAP/Gmail; el correo sigue en "requieren atención" sin borrador.
        }
      }

      return {
        ...email,
        ...clasificacion,
        importante,
        requiere_atencion: importante ? true : clasificacion?.requiere_atencion,
        borrador,
        conciliacion,
      };
    }),
  );

  return NextResponse.json({ results });
}
