import { tool } from "ai";
import { z } from "zod";
import { groupByVendor, loadSapRows, queryInvoices, summarizeInvoices } from "@/lib/tools/sap-data";

export const sapConsultaTool = tool({
  description:
    "Consulta flexible sobre el archivo SAP más reciente: filtra por proveedor, número de factura (sin necesidad de saber el proveedor), rango de fechas de clearing, moneda, o solo pendientes. Con agruparPorProveedor=true agrupa por proveedor con conteo y suma — úsala para rankings ('los 5 proveedores con más pendiente') o totales agregados ('cuánto se le ha pagado a X en total este año'). Para 'detalle de un pago en una fecha exacta' o 'pendientes de un proveedor' usa mejor sap_detalle_pago / sap_facturas_pendientes.",
  inputSchema: z.object({
    proveedor: z.string().optional().describe("Filtra por nombre (o parte) de proveedor"),
    factura: z.string().optional().describe("Busca por número/referencia de factura (parcial)"),
    fechaDesde: z.string().optional().describe("YYYY-MM-DD, clearing date desde esta fecha"),
    fechaHasta: z.string().optional().describe("YYYY-MM-DD, clearing date hasta esta fecha"),
    moneda: z.string().optional().describe("Filtra por moneda, ej. 'USD' o 'MXN'"),
    soloPendientes: z
      .boolean()
      .optional()
      .describe("true = solo facturas cuyo WF Step no sea 'WF finished'"),
    agruparPorProveedor: z
      .boolean()
      .optional()
      .describe(
        "true = devuelve totales y conteo de facturas por proveedor (ordenado de mayor a menor) en vez de la lista de facturas individuales",
      ),
    limite: z
      .number()
      .optional()
      .describe(
        "Si agruparPorProveedor: cuántos proveedores del ranking devolver (top N). Si no: cuántas facturas individuales devolver como máximo (por defecto 50)",
      ),
  }),
  execute: async (params) => {
    try {
      const { rows, fileName } = await loadSapRows();
      const filtered = queryInvoices(rows, {
        vendorQuery: params.proveedor,
        reference: params.factura,
        dateFrom: params.fechaDesde,
        dateTo: params.fechaHasta,
        currency: params.moneda,
        onlyPending: params.soloPendientes,
      });

      if (params.agruparPorProveedor) {
        const grouped = groupByVendor(filtered).sort((a, b) => {
          const totalA = Object.values(a.totales_por_moneda).reduce((s, v) => s + v, 0);
          const totalB = Object.values(b.totales_por_moneda).reduce((s, v) => s + v, 0);
          return totalB - totalA;
        });
        return {
          archivo: fileName,
          proveedores: params.limite ? grouped.slice(0, params.limite) : grouped,
        };
      }

      const limite = params.limite ?? 50;
      return {
        archivo: fileName,
        totalCoincidencias: filtered.length,
        ...summarizeInvoices(filtered.slice(0, limite)),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "No se pudo leer el archivo SAP." };
    }
  },
});
