import ExcelJS from "exceljs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { retryOnTransientFsError } from "@/lib/retry";

export type SapRow = {
  vendorId: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  currency: string;
  wfStep: string;
  documentDate: string | null;
  netDueDate: string | null;
  clearingDate: string | null;
  clearingDocument: string | null;
};

const COLUMN_MAP: Record<string, keyof SapRow> = {
  "Vendor / Customer": "vendorId",
  Name: "vendorName",
  Reference: "reference",
  "Total amount": "totalAmount",
  Currency: "currency",
  "WF Step Description": "wfStep",
  "Document Date": "documentDate",
  "Net Due Date": "netDueDate",
  "Clearing Date": "clearingDate",
  "Clearing Document": "clearingDocument",
};

function toIsoDate(value: ExcelJS.CellValue): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text);
  return String(value);
}

const SAP_DIR =
  process.env.BALTIMORE_SAP_DIR ??
  "/Users/cristianborja/Library/CloudStorage/GoogleDrive-cristiancamilo0305@gmail.com/Mi unidad/Baltimore - SAP";

async function findLatestSapFile(): Promise<string> {
  const entries = await retryOnTransientFsError(() => readdir(SAP_DIR, { withFileTypes: true }));
  const candidates = entries.filter((e) => e.isFile() && /^sap.*\.xlsx$/i.test(e.name));
  if (candidates.length === 0) {
    throw new Error(`No encontré ningún archivo SAP*.xlsx en ${SAP_DIR}`);
  }

  const withMtime = await Promise.all(
    candidates.map(async (e) => ({
      name: e.name,
      mtime: (await stat(path.join(SAP_DIR, e.name))).mtimeMs,
    })),
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);
  return path.join(SAP_DIR, withMtime[0].name);
}

/** Lee y parsea el SAP*.xlsx más reciente sincronizado localmente vía Google Drive Desktop. No cachea. */
export async function loadSapRows(): Promise<{ rows: SapRow[]; fileName: string }> {
  const filePath = await findLatestSapFile();
  const workbook = new ExcelJS.Workbook();
  await retryOnTransientFsError(() => workbook.xlsx.readFile(filePath));
  const sheet = workbook.worksheets[0];

  const colIndex: Partial<Record<keyof SapRow, number>> = {};
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const key = COLUMN_MAP[cellText(cell.value).trim()];
    if (key) colIndex[key] = colNumber;
  });

  const rows: SapRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (key: keyof SapRow) => {
      const idx = colIndex[key];
      return idx ? row.getCell(idx).value : null;
    };

    const vendorName = cellText(get("vendorName"));
    if (!vendorName) return;

    rows.push({
      vendorId: cellText(get("vendorId")),
      vendorName,
      reference: cellText(get("reference")),
      totalAmount: Number(get("totalAmount")) || 0,
      currency: cellText(get("currency")),
      wfStep: cellText(get("wfStep")),
      documentDate: toIsoDate(get("documentDate")),
      netDueDate: toIsoDate(get("netDueDate")),
      clearingDate: toIsoDate(get("clearingDate")),
      clearingDocument: cellText(get("clearingDocument")) || null,
    });
  });

  return { rows, fileName: path.basename(filePath) };
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filterByVendor(rows: SapRow[], vendorQuery: string): SapRow[] {
  const q = normalize(vendorQuery);
  return rows.filter((r) => normalize(r.vendorName).includes(q));
}

/** Facturas de un proveedor liquidadas (Clearing Date) en una fecha específica (YYYY-MM-DD). */
export function getPaymentDetail(
  rows: SapRow[],
  vendorQuery: string,
  clearingDate: string,
): SapRow[] {
  return filterByVendor(rows, vendorQuery).filter((r) => r.clearingDate === clearingDate);
}

/** Facturas de un proveedor cuyo flujo de aprobación no ha terminado (WF Step != "WF finished"). */
export function getPendingInvoices(rows: SapRow[], vendorQuery: string): SapRow[] {
  return filterByVendor(rows, vendorQuery).filter(
    (r) => normalize(r.wfStep) !== "wf finished",
  );
}

/**
 * Facturas por pagar en la semana de pago (viernes) indicada. Reproduce la regla documentada
 * en el "Payment List" semanal de Baltimore: sin Clearing Document (no liquidada todavía) y con
 * Net Due Date <= viernes + 1 día. Se calcula directo sobre el SAP más reciente en vez de leer
 * el archivo pesado de Payment List (que además a veces no trae la hoja calculada actualizada).
 */
export function getInvoicesDueByFriday(rows: SapRow[], fridayDate: string): SapRow[] {
  const limite = new Date(`${fridayDate}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 1);
  const limiteIso = limite.toISOString().slice(0, 10);

  return rows.filter((r) => !r.clearingDocument && r.netDueDate && r.netDueDate <= limiteIso);
}

export type SapQueryFilters = {
  vendorQuery?: string;
  reference?: string;
  dateFrom?: string;
  dateTo?: string;
  currency?: string;
  onlyPending?: boolean;
};

/** Filtro genérico y combinable sobre las facturas de SAP. */
export function queryInvoices(rows: SapRow[], filters: SapQueryFilters): SapRow[] {
  return rows.filter((r) => {
    if (filters.vendorQuery && !normalize(r.vendorName).includes(normalize(filters.vendorQuery))) {
      return false;
    }
    if (filters.reference && !normalize(r.reference).includes(normalize(filters.reference))) {
      return false;
    }
    if (filters.currency && r.currency.toUpperCase() !== filters.currency.toUpperCase()) {
      return false;
    }
    if (filters.onlyPending && normalize(r.wfStep) === "wf finished") return false;
    if (filters.dateFrom && (!r.clearingDate || r.clearingDate < filters.dateFrom)) return false;
    if (filters.dateTo && (!r.clearingDate || r.clearingDate > filters.dateTo)) return false;
    return true;
  });
}

export type VendorTotal = {
  proveedor: string;
  facturas: number;
  totales_por_moneda: Record<string, number>;
};

/** Agrupa facturas por proveedor con conteo y suma por moneda — para rankings y comparaciones. */
export function groupByVendor(rows: SapRow[]): VendorTotal[] {
  const map = new Map<string, VendorTotal>();
  for (const r of rows) {
    let entry = map.get(r.vendorName);
    if (!entry) {
      entry = { proveedor: r.vendorName, facturas: 0, totales_por_moneda: {} };
      map.set(r.vendorName, entry);
    }
    entry.facturas += 1;
    entry.totales_por_moneda[r.currency] = (entry.totales_por_moneda[r.currency] ?? 0) + r.totalAmount;
  }
  return [...map.values()];
}

/**
 * Último recurso cuando no hay nombre de proveedor: si el correo menciona un monto exacto,
 * busca qué proveedor tiene facturas liquidadas esa fecha cuya suma coincide con ese monto.
 */
export function resolveVendorByAmountAndDate(
  rows: SapRow[],
  amount: number,
  clearingDate: string,
): string | null {
  const sameDay = rows.filter((r) => r.clearingDate === clearingDate);
  const totals = groupByVendor(sameDay);
  const match = totals.find((v) =>
    Object.values(v.totales_por_moneda).some((total) => Math.abs(total - amount) < 0.5),
  );
  return match?.proveedor ?? null;
}

/** Resumen de una lista de facturas: forma de salida compartida por las tools de chat. */
export function summarizeInvoices(rows: SapRow[]) {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.totalAmount);
  return {
    facturas: rows.map((r) => ({
      proveedor: r.vendorName,
      referencia: r.reference,
      monto: r.totalAmount,
      moneda: r.currency,
      estatus_wf: r.wfStep,
      fecha_documento: r.documentDate,
      fecha_vencimiento: r.netDueDate,
      fecha_clearing: r.clearingDate,
      documento_clearing: r.clearingDocument,
    })),
    totales_por_moneda: Object.fromEntries(totals),
  };
}

const money = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Cuerpo de correo determinístico con el desglose de facturas de un pago. Sin LLM: nada que inventar. */
export function formatPaymentSummaryEmail(
  vendorName: string,
  clearingDate: string,
  rows: SapRow[],
): string {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.totalAmount);

  const lines = rows.map(
    (r) => `- Factura ${r.reference}: ${money.format(r.totalAmount)} ${r.currency}`,
  );
  const totalLines = [...totals.entries()].map(
    ([currency, amount]) => `Total ${currency}: ${money.format(amount)}`,
  );

  return [
    `${greeting()},`,
    "",
    `Comparto detalle del pago realizado a ${vendorName} el ${clearingDate}:`,
    "",
    ...lines,
    "",
    ...totalLines,
    "",
    "Quedo atento a cualquier duda.",
    "",
    "Saludos,",
    "Cristian",
  ].join("\n");
}
