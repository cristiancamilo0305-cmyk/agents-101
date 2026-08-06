import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/gmail-auth";
import { createReplyDraft, extractEmail, getMessageBody, listUnreadMessages } from "@/lib/gmail";
import { classifyEmails, extractPaymentDetailsFromBody, hasImportantKeyword } from "@/lib/tools/email-classifier";
import {
  formatPaymentSummaryEmail,
  getPaymentDetail,
  loadSapRows,
  resolveVendorByAmountAndDate,
  type SapRow,
} from "@/lib/tools/sap-data";
import {
  extractAmountCandidates,
  findVendorMentionInThread,
  resolveVendorFromSenderHistory,
  resolveVendorFromThreadReferences,
} from "@/lib/tools/vendor-resolver";
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

export async function POST() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const emails = await listUnreadMessages(accessToken, 50);
  const clasificaciones = await classifyEmails(emails);

  let sapRows: SapRow[] | null = null;
  async function getSapRows(): Promise<SapRow[]> {
    if (!sapRows) sapRows = (await loadSapRows()).rows;
    return sapRows;
  }

  const results = await Promise.all(
    emails.map(async (email) => {
      const clasificacion = clasificaciones.find((c) => c.id === email.id);
      const importante = hasImportantKeyword(email);

      let borrador: { id: string; preview: string } | undefined;
      if (clasificacion?.necesita_detalle_pago) {
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
              const body = formatPaymentSummaryEmail(resuelto.proveedor, fechaPago, resuelto.matches);
              const draft = await createReplyDraft(accessToken, email, body);
              borrador = { id: draft.id, preview: body };
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
      };
    }),
  );

  return NextResponse.json({ results });
}
