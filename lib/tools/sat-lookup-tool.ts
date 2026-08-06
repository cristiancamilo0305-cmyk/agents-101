import { tool } from "ai";
import { z } from "zod";
import { findByUuid, loadSatRows } from "@/lib/tools/sat-data";

export const satConsultaUuidTool = tool({
  description:
    "Busca un CFDI (factura fiscal) por su UUID en el archivo SAT más reciente ('Baltimore - SAP' en Drive, archivo SAT*.xlsx). Devuelve emisor, RFC, folio, estatus SAT (Vigente/Cancelado), total, si está pagado, importe pendiente y UUID relacionado (para notas de crédito).",
  inputSchema: z.object({
    uuid: z.string().describe("UUID completo o parcial del CFDI a buscar"),
  }),
  execute: async ({ uuid }) => {
    try {
      const { rows, fileName } = await loadSatRows();
      const matches = findByUuid(rows, uuid);
      return {
        archivo: fileName,
        totalCoincidencias: matches.length,
        resultados: matches.slice(0, 20).map((r) => ({
          uuid: r.uuid,
          uuid_relacionado: r.uuidRelacionado,
          emisor: r.razonSocialEmisor,
          rfc: r.rfc,
          folio: r.folio,
          serie: r.serie,
          estatus_sat: r.estatusSat,
          tipo: r.tipo,
          fecha_expedicion: r.fechaExpedicion,
          moneda: r.moneda,
          total: r.total,
          pagado: r.pagado,
          importe_pendiente: r.importePendiente,
          fecha_pago: r.fechaPago,
        })),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "No se pudo leer el archivo SAT." };
    }
  },
});
