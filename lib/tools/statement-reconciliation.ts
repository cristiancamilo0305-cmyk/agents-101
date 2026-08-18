import type { SapRow } from "@/lib/tools/sap-data";
import type { SatRow } from "@/lib/tools/sat-data";
import type { ClaimedInvoice } from "@/lib/tools/statement-extraction";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Como normalize(), pero también quita comas y puntos — para comparar razón social, donde el
 *  proveedor declarado (vía IA) y el capturado en SAP casi nunca puntúan igual (ej. "TISAL 4850,
 *  S.A. DE C.V." vs "TISAL 4850 S.A. DE C.V."). Solo para comparar, nunca para mostrar en pantalla. */
function normalizeVendorName(text: string): string {
  return normalize(text)
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRef(text: string): string {
  return text.replace(/\s+/g, "").toUpperCase();
}

/** Solo los dígitos, sin ceros a la izquierda — para cuando la misma factura queda capturada
 *  con o sin prefijo de letras (ej. "FV004612" en el estado de cuenta vs "4612" en SAP). */
function digitsOnly(text: string): string {
  const digits = text.replace(/\D/g, "").replace(/^0+/, "");
  return digits || "0";
}
const MIN_DIGITS_FOR_FALLBACK = 3;

export type InvoiceReconciliation = {
  numeroDeclarado: string;
  montoDeclarado: number;
  monedaDeclarada?: string;
  encontradaEnSap: boolean;
  sapReferencia?: string;
  sapMonto?: number;
  sapMoneda?: string;
  montoCoincide?: boolean;
  pagada: boolean;
  fechaPago?: string | null;
  lotePago?: string | null;
  sapWfStep?: string;
  fechaVencimiento?: string | null;
  vencida: boolean;
  estatusSat?: string;
  canceladaEnSat: boolean;
  observacion: string;
};

const AMOUNT_TOLERANCE = 0.5;

/**
 * Busca la factura en SAP por referencia exacta y, si no aparece, por solo-dígitos (para
 * capturas sin el prefijo de letras). El match por solo-dígitos es mucho más propenso a chocar
 * con la factura de OTRO proveedor que casualmente comparte los mismos números — así que cuando
 * se conoce el proveedor, un candidato de otro proveedor se descarta en vez de usarse "por
 * default"; nunca se mezcla el lote/fecha de pago de un proveedor con la factura de otro.
 */
function findSapMatch(rows: SapRow[], numero: string, vendorHint: string | null): SapRow | undefined {
  const key = normalizeRef(numero);
  const vendorKey = vendorHint ? normalizeVendorName(vendorHint) : null;
  const matchesVendor = (r: SapRow) =>
    !vendorKey || normalizeVendorName(r.vendorName).includes(vendorKey) || vendorKey.includes(normalizeVendorName(r.vendorName));

  const exact = rows.filter((r) => normalizeRef(r.reference) === key);
  const exactForVendor = exact.filter(matchesVendor);
  if (exactForVendor.length > 0) return exactForVendor[0];
  if (!vendorKey && exact.length > 0) return exact[0];

  const numKey = digitsOnly(numero);
  if (numKey.length >= MIN_DIGITS_FOR_FALLBACK) {
    const fuzzy = rows.filter((r) => r.reference && digitsOnly(r.reference) === numKey);
    const fuzzyForVendor = fuzzy.filter(matchesVendor);
    if (fuzzyForVendor.length > 0) return fuzzyForVendor[0];
    if (!vendorKey && fuzzy.length === 1) return fuzzy[0];
  }

  return undefined;
}

/** Misma lógica de no-mezclar-proveedores que findSapMatch, comparando contra el emisor del CFDI. */
function findSatMatch(satRows: SatRow[], numero: string, vendorHint: string | null): SatRow | undefined {
  const key = normalizeRef(numero);
  const vendorKey = vendorHint ? normalizeVendorName(vendorHint) : null;
  const matchesVendor = (r: SatRow) =>
    !vendorKey ||
    normalizeVendorName(r.razonSocialEmisor).includes(vendorKey) ||
    vendorKey.includes(normalizeVendorName(r.razonSocialEmisor));

  const exact = satRows.filter((r) => normalizeRef(r.folio) === key || (r.referencia && normalizeRef(r.referencia) === key));
  const exactForVendor = exact.filter(matchesVendor);
  if (exactForVendor.length > 0) return exactForVendor[0];
  if (!vendorKey && exact.length > 0) return exact[0];

  const numKey = digitsOnly(numero);
  if (numKey.length < MIN_DIGITS_FOR_FALLBACK) return undefined;
  const fuzzy = satRows.filter(
    (r) => (r.folio && digitsOnly(r.folio) === numKey) || (r.referencia && digitsOnly(r.referencia) === numKey),
  );
  const fuzzyForVendor = fuzzy.filter(matchesVendor);
  if (fuzzyForVendor.length > 0) return fuzzyForVendor[0];
  if (!vendorKey && fuzzy.length === 1) return fuzzy[0];
  return undefined;
}

/**
 * Compara cada factura declarada por el proveedor en su estado de cuenta contra el SAP y SAT
 * más recientes: existencia, coincidencia de monto, si ya está pagada (fecha + lote de pago), y
 * si el CFDI está cancelado en SAT. Criterio de conciliador: no asumir nada que no esté en los datos.
 */
export function reconcileClaimedInvoices(
  rows: SapRow[],
  satRows: SatRow[],
  vendorHint: string | null,
  claimed: ClaimedInvoice[],
): InvoiceReconciliation[] {
  const hoy = new Date().toISOString().slice(0, 10);

  return claimed.map((c) => {
    const sapMatch = findSapMatch(rows, c.numero, vendorHint);
    const satMatch = findSatMatch(satRows, c.numero, vendorHint);
    const pagada = Boolean(sapMatch?.clearingDocument);
    const canceladaEnSat = normalize(satMatch?.estatusSat ?? "") === "cancelado";
    const vencida = Boolean(!pagada && sapMatch?.netDueDate && sapMatch.netDueDate < hoy);

    const montoCoincide = sapMatch ? Math.abs(sapMatch.totalAmount - c.monto) <= AMOUNT_TOLERANCE : undefined;

    const observacionPartes: string[] = [];
    if (!sapMatch) {
      observacionPartes.push("No se encontró esta factura en SAP.");
    } else {
      observacionPartes.push(
        montoCoincide
          ? "Monto coincide con SAP."
          : `Monto declarado (${c.monto}) no coincide con SAP (${sapMatch.totalAmount}).`,
      );
      observacionPartes.push(
        pagada
          ? `Ya pagada el ${sapMatch.clearingDate ?? "(fecha no registrada)"}, lote de pago ${sapMatch.clearingDocument}.`
          : `Pendiente de pago (estatus: ${sapMatch.wfStep || "sin estatus"}).`,
      );
      if (vencida) observacionPartes.push(`⚠️ Vencida desde el ${sapMatch!.netDueDate}.`);
    }
    if (canceladaEnSat) observacionPartes.push("⚠️ CFDI aparece CANCELADO en SAT.");

    return {
      numeroDeclarado: c.numero,
      montoDeclarado: c.monto,
      monedaDeclarada: c.moneda,
      encontradaEnSap: Boolean(sapMatch),
      sapReferencia: sapMatch?.reference,
      sapMonto: sapMatch?.totalAmount,
      sapMoneda: sapMatch?.currency,
      montoCoincide,
      pagada,
      fechaPago: sapMatch?.clearingDate,
      lotePago: sapMatch?.clearingDocument,
      sapWfStep: sapMatch?.wfStep,
      fechaVencimiento: sapMatch?.netDueDate,
      vencida,
      estatusSat: satMatch?.estatusSat,
      canceladaEnSat,
      observacion: observacionPartes.join(" "),
    };
  });
}

const money = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Estatus a mostrar: "Pagada" si ya se liquidó; si no, el WF Step Description real de SAP (no un genérico "Pendiente"), marcando VENCIDA cuando ya pasó la fecha de vencimiento. */
export function estatusLabel(r: InvoiceReconciliation): string {
  if (!r.encontradaEnSap) return "No encontrada";
  if (r.pagada) return "Pagada";
  const base = r.sapWfStep || "Sin estatus en SAP";
  return r.vencida ? `${base} (VENCIDA)` : base;
}

/** Fecha y lote de pago cuando ya está pagada; "—" si no aplica (columna aparte para que sea visible de un vistazo). */
export function pagoLabel(r: InvoiceReconciliation): string {
  if (!r.encontradaEnSap || !r.pagada) return "—";
  return `${r.fechaPago ?? "?"} · lote ${r.lotePago ?? "?"}`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Cuerpo de correo (texto plano, con tabla alineada) para responder un estado de cuenta con el resultado de la conciliación. */
export function formatStatementReconciliationEmail(
  vendorName: string | null,
  reconciliations: InvoiceReconciliation[],
): string {
  const header = ["Factura", "Monto declarado", "En SAP", "Monto SAP", "¿Coincide?", "Estatus", "Fecha de pago", "SAT"];
  const rows = reconciliations.map((r) => [
    r.numeroDeclarado,
    `${money.format(r.montoDeclarado)} ${r.monedaDeclarada ?? ""}`.trim(),
    r.encontradaEnSap ? "Sí" : "No",
    r.encontradaEnSap ? `${money.format(r.sapMonto ?? 0)} ${r.sapMoneda ?? ""}`.trim() : "—",
    r.encontradaEnSap ? (r.montoCoincide ? "Sí" : "No") : "—",
    estatusLabel(r),
    pagoLabel(r),
    r.canceladaEnSat ? "CANCELADO" : r.estatusSat || "—",
  ]);

  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const pad = (text: string, w: number) => text + " ".repeat(Math.max(0, w - text.length));
  const line = (cells: string[]) => cells.map((c, i) => pad(c, widths[i])).join("  |  ");
  const separator = widths.map((w) => "-".repeat(w)).join("--+--");

  const discrepancias = reconciliations.filter(
    (r) => !r.encontradaEnSap || r.montoCoincide === false || r.canceladaEnSat || r.vencida,
  );

  const lines = [
    `${greeting()},`,
    "",
    `Revisamos el estado de cuenta${vendorName ? ` de ${vendorName}` : ""} contra nuestros registros en SAP y SAT. Detalle:`,
    "",
    line(header),
    separator,
    ...rows.map(line),
    "",
  ];

  if (discrepancias.length > 0) {
    lines.push(
      "Encontramos las siguientes diferencias que quedamos atentos a revisar en conjunto:",
      ...discrepancias.map((r) => `- Factura ${r.numeroDeclarado}: ${r.observacion}`),
      "",
    );
  } else {
    lines.push("Todas las facturas coinciden con nuestros registros.", "");
  }

  lines.push("Quedamos atentos a cualquier duda.", "", "Saludos,", "Cristian");

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const HTML_HEADER = ["Factura", "Monto declarado", "En SAP", "Monto SAP", "¿Coincide?", "Estatus", "Fecha de pago", "SAT"];
const TH_STYLE =
  "border:1px solid #333333;padding:6px 10px;background:#f2f2f2;text-align:left;font-weight:600;white-space:nowrap;";
const TD_STYLE = "border:1px solid #333333;padding:6px 10px;text-align:left;white-space:nowrap;";

function statementRowCells(r: InvoiceReconciliation): string[] {
  return [
    r.numeroDeclarado,
    `${money.format(r.montoDeclarado)} ${r.monedaDeclarada ?? ""}`.trim(),
    r.encontradaEnSap ? "Sí" : "No",
    r.encontradaEnSap ? `${money.format(r.sapMonto ?? 0)} ${r.sapMoneda ?? ""}`.trim() : "—",
    r.encontradaEnSap ? (r.montoCoincide ? "Sí" : "No") : "—",
    estatusLabel(r),
    pagoLabel(r),
    r.canceladaEnSat ? "CANCELADO" : r.estatusSat || "—",
  ];
}

/** Misma conciliación que formatStatementReconciliationEmail, pero como HTML con una tabla real (bordes visibles en Gmail) en vez de texto alineado con "|". */
export function formatStatementReconciliationEmailHtml(
  vendorName: string | null,
  reconciliations: InvoiceReconciliation[],
): string {
  const headerRow = `<tr>${HTML_HEADER.map((h) => `<th style="${TH_STYLE}">${h}</th>`).join("")}</tr>`;
  const bodyRows = reconciliations
    .map((r) => {
      const cells = statementRowCells(r).map((c) => `<td style="${TD_STYLE}">${escapeHtml(c)}</td>`);
      const highlight = r.canceladaEnSat || r.montoCoincide === false || !r.encontradaEnSap || r.vencida;
      return `<tr${highlight ? ' style="background:#fff4f4;"' : ""}>${cells.join("")}</tr>`;
    })
    .join("");

  const table = `<table style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:13px;">${headerRow}${bodyRows}</table>`;

  const discrepancias = reconciliations.filter(
    (r) => !r.encontradaEnSap || r.montoCoincide === false || r.canceladaEnSat || r.vencida,
  );

  const discrepanciasHtml =
    discrepancias.length > 0
      ? `<p>Encontramos las siguientes diferencias que quedamos atentos a revisar en conjunto:</p><ul>${discrepancias
          .map((r) => `<li>Factura ${escapeHtml(r.numeroDeclarado)}: ${escapeHtml(r.observacion)}</li>`)
          .join("")}</ul>`
      : `<p>Todas las facturas coinciden con nuestros registros.</p>`;

  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111111;">`,
    `<p>${greeting()},</p>`,
    `<p>Revisamos el estado de cuenta${vendorName ? ` de ${escapeHtml(vendorName)}` : ""} contra nuestros registros en SAP y SAT. Detalle:</p>`,
    table,
    discrepanciasHtml,
    `<p>Quedamos atentos a cualquier duda.</p>`,
    `<p>Saludos,<br>Cristian</p>`,
    `</div>`,
  ].join("\n");
}
