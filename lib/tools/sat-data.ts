import ExcelJS from "exceljs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { retryOnTransientFsError } from "@/lib/retry";

export type SatRow = {
  uuid: string;
  uuidRelacionado: string | null;
  folio: string;
  serie: string;
  rfc: string;
  razonSocialEmisor: string;
  estatusSat: string;
  tipo: string;
  fechaExpedicion: string | null;
  fechaTimbrado: string | null;
  moneda: string;
  total: number;
  pagado: string;
  importePendiente: number;
  fechaPago: string | null;
  referencia: string;
};

const COLUMN_MAP: Record<string, keyof SatRow> = {
  UUID: "uuid",
  "UUID Relacionado": "uuidRelacionado",
  Folio: "folio",
  Serie: "serie",
  RFC: "rfc",
  "Razón social Emisor": "razonSocialEmisor",
  "Estatus Sat": "estatusSat",
  Tipo: "tipo",
  "Fecha Expedición": "fechaExpedicion",
  "Fecha Timbrado": "fechaTimbrado",
  Moneda: "moneda",
  Total: "total",
  Pagado: "pagado",
  "Importe pendiente": "importePendiente",
  "Fecha de pago": "fechaPago",
  Referencia: "referencia",
};

const SAT_DIR =
  process.env.BALTIMORE_SAP_DIR ??
  "/Users/cristianborja/Library/CloudStorage/GoogleDrive-cristiancamilo0305@gmail.com/Mi unidad/Baltimore - SAP";

async function findLatestSatFile(): Promise<string> {
  const entries = await retryOnTransientFsError(() => readdir(SAT_DIR, { withFileTypes: true }));
  const candidates = entries.filter((e) => e.isFile() && /^sat.*\.xlsx$/i.test(e.name));
  if (candidates.length === 0) {
    throw new Error(`No encontré ningún archivo SAT*.xlsx en ${SAT_DIR}`);
  }

  const withMtime = await Promise.all(
    candidates.map(async (e) => ({
      name: e.name,
      mtime: (await stat(path.join(SAT_DIR, e.name))).mtimeMs,
    })),
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);
  return path.join(SAT_DIR, withMtime[0].name);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text);
  return String(value);
}

function toIsoDate(value: ExcelJS.CellValue): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

/** Lee y parsea el SAT*.xlsx más reciente. Los encabezados reales no están en la fila 1 —
 *  las primeras filas son título del reporte — así que se busca la fila que contenga "UUID". */
export async function loadSatRows(): Promise<{ rows: SatRow[]; fileName: string }> {
  const filePath = await findLatestSatFile();
  const workbook = new ExcelJS.Workbook();
  await retryOnTransientFsError(() => workbook.xlsx.readFile(filePath));
  const sheet = workbook.worksheets[0];

  let headerRowNumber = 1;
  for (let r = 1; r <= 10; r++) {
    let hasUuid = false;
    sheet.getRow(r).eachCell((cell) => {
      if (cellText(cell.value).trim() === "UUID") hasUuid = true;
    });
    if (hasUuid) {
      headerRowNumber = r;
      break;
    }
  }

  const colIndex: Partial<Record<keyof SatRow, number>> = {};
  sheet.getRow(headerRowNumber).eachCell((cell, colNumber) => {
    const key = COLUMN_MAP[cellText(cell.value).trim()];
    if (key) colIndex[key] = colNumber;
  });

  const rows: SatRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const get = (key: keyof SatRow) => {
      const idx = colIndex[key];
      return idx ? row.getCell(idx).value : null;
    };

    const uuid = cellText(get("uuid"));
    if (!uuid) return;

    rows.push({
      uuid,
      uuidRelacionado: cellText(get("uuidRelacionado")) || null,
      folio: cellText(get("folio")),
      serie: cellText(get("serie")),
      rfc: cellText(get("rfc")),
      razonSocialEmisor: cellText(get("razonSocialEmisor")),
      estatusSat: cellText(get("estatusSat")),
      tipo: cellText(get("tipo")),
      fechaExpedicion: toIsoDate(get("fechaExpedicion")),
      fechaTimbrado: toIsoDate(get("fechaTimbrado")),
      moneda: cellText(get("moneda")),
      total: Number(get("total")) || 0,
      pagado: cellText(get("pagado")),
      importePendiente: Number(get("importePendiente")) || 0,
      fechaPago: toIsoDate(get("fechaPago")),
      referencia: cellText(get("referencia")),
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

/** Busca por UUID exacto o parcial (por si solo tienen un fragmento). */
export function findByUuid(rows: SatRow[], uuidQuery: string): SatRow[] {
  const q = normalize(uuidQuery);
  return rows.filter((r) => normalize(r.uuid).includes(q));
}
