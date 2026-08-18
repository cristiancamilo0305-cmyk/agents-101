import ExcelJS from "exceljs";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getChatModel } from "@/lib/chat-model";
import type { GmailAttachmentRef } from "@/lib/gmail";

export type AttachmentPayload = GmailAttachmentRef & { data: Buffer };

const claimedInvoiceSchema = z.object({
  numero: z.string().describe("Número/folio/referencia de la factura tal como aparece en el estado de cuenta"),
  monto: z.number().describe("Monto total de la factura"),
  moneda: z.string().optional().describe("Moneda si se indica, ej. 'USD' o 'MXN'"),
  fecha: z.string().optional().describe("Fecha de la factura en YYYY-MM-DD si se indica"),
});

const statementSchema = z.object({
  proveedorDeclarado: z
    .string()
    .optional()
    .describe("Nombre del proveedor que envía el estado de cuenta, si se identifica"),
  facturas: z.array(claimedInvoiceSchema),
});

export type ClaimedInvoice = z.infer<typeof claimedInvoiceSchema>;
export type StatementExtraction = z.infer<typeof statementSchema>;

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MIN_IMAGE_BYTES = 15 * 1024; // filtra logos/firmas pequeños incrustados en el cuerpo
const MAX_ATTACHMENTS = 5;

function isExcel(mimeType: string): boolean {
  return (
    mimeType.includes("spreadsheetml") ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "text/csv"
  );
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

async function excelToText(data: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as ArrayBuffer);
  const lines: string[] = [];
  for (const sheet of workbook.worksheets) {
    lines.push(`--- Hoja: ${sheet.name} ---`);
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => cells.push(cellText(cell.value)));
      if (cells.some((c) => c.trim())) lines.push(cells.join(" | "));
    });
  }
  return lines.join("\n").slice(0, 12000);
}

/**
 * Lee el cuerpo del correo y sus adjuntos (Excel, PDF, o imagen con el detalle en texto) y extrae
 * las facturas que el proveedor declara pendientes de pago. Usa Gemini con visión para PDF/imagen
 * directamente (sin OCR aparte); Excel se aplana a texto porque el formato varía por proveedor.
 */
export async function extractStatementInvoices(
  bodyText: string,
  attachments: AttachmentPayload[],
): Promise<StatementExtraction> {
  const usable = attachments
    .filter((a) => a.data.byteLength > 0 && a.data.byteLength <= MAX_ATTACHMENT_BYTES)
    .filter((a) => !isImage(a.mimeType) || a.data.byteLength >= MIN_IMAGE_BYTES)
    .filter((a) => isExcel(a.mimeType) || isPdf(a.mimeType) || isImage(a.mimeType))
    // Excel/PDF primero: casi siempre son el estado de cuenta real, mientras que las imágenes
    // adjuntas suelen ser banners/logos de firma de correo — no deben desplazar al archivo real
    // cuando hay más adjuntos que el límite (ej. un correo con 10 imágenes de firma + 1 Excel).
    .sort((a, b) => Number(isImage(a.mimeType)) - Number(isImage(b.mimeType)))
    .slice(0, MAX_ATTACHMENTS);

  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "file"; mediaType: string; data: Buffer; filename?: string }
  > = [
    {
      type: "text",
      text: `Este es un estado de cuenta o relación de facturas pendientes de pago enviado por un proveedor a su cliente "Baltimore" (o "Baltimore Aircoil Company de México"). Extrae cada factura mencionada como pendiente de pago (número/folio, monto, moneda si se indica, fecha si se indica), y si es posible identifica el nombre del proveedor que envía el estado de cuenta.

IMPORTANTE sobre "proveedorDeclarado": es quien EMITE el estado de cuenta (a quién se le debe pagar), nunca "Baltimore" / "Baltimore Aircoil" — ese es el cliente que RECIBE el estado de cuenta y aparece mencionado en el encabezado o asunto, pero NUNCA es el proveedor. Si el único nombre de proveedor que identificas es una variante de "Baltimore", deja "proveedorDeclarado" vacío en vez de poner "Baltimore".

No inventes datos que no aparezcan.

Cuerpo del correo:
${bodyText || "(sin texto relevante en el cuerpo)"}`,
    },
  ];

  for (const attachment of usable) {
    if (isExcel(attachment.mimeType)) {
      try {
        const text = await excelToText(attachment.data);
        contentParts.push({
          type: "text",
          text: `Adjunto "${attachment.filename}" (Excel), contenido:\n${text}`,
        });
      } catch {
        // Adjunto Excel corrupto/no parseable: se ignora, no bloquea el resto del análisis.
      }
    } else {
      contentParts.push({
        type: "file",
        mediaType: attachment.mimeType,
        data: attachment.data,
        filename: attachment.filename,
      });
    }
  }

  const { output } = await generateText({
    model: getChatModel(),
    output: Output.object({ schema: statementSchema }),
    messages: [{ role: "user", content: contentParts }],
  });

  // Respaldo por si el modelo confunde al cliente ("Baltimore") con el proveedor a pesar de la
  // instrucción — nunca es válido como proveedorDeclarado.
  if (output.proveedorDeclarado && /baltimore/i.test(output.proveedorDeclarado)) {
    output.proveedorDeclarado = undefined;
  }

  return output;
}
