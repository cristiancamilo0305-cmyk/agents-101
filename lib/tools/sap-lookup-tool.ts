import { tool } from "ai";
import { z } from "zod";
import {
  getInvoicesDueByFriday,
  getPaymentDetail,
  getPendingInvoices,
  loadSapRows,
  summarizeInvoices,
} from "@/lib/tools/sap-data";

export const sapDetallePagoTool = tool({
  description:
    "Busca en el archivo SAP más reciente ('Baltimore - SAP', sincronizado localmente vía Google Drive Desktop) las facturas de un proveedor liquidadas en una fecha de clearing específica. Úsala cuando pidan el detalle/desglose de un pago a un proveedor en una fecha.",
  inputSchema: z.object({
    proveedor: z.string().describe("Nombre (o parte del nombre) del proveedor, ej. 'Fastenal'"),
    fechaClearing: z
      .string()
      .describe("Fecha de clearing en formato YYYY-MM-DD, ej. '2026-07-31'"),
  }),
  execute: async ({ proveedor, fechaClearing }) => {
    try {
      const { rows, fileName } = await loadSapRows();
      const matches = getPaymentDetail(rows, proveedor, fechaClearing);
      return { archivo: fileName, ...summarizeInvoices(matches) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "No se pudo leer el archivo SAP." };
    }
  },
});

export const sapFacturasSemanaTool = tool({
  description:
    "Calcula qué facturas corresponde pagar en la semana de pago (viernes) indicada, aplicando la regla de Baltimore para el Payment List semanal: sin Clearing Document (no liquidada todavía) y con Net Due Date <= viernes + 1 día. Se calcula en vivo sobre el SAP más reciente. Úsala cuando pregunten qué hay que pagar 'esta semana' o en una semana/viernes específico, no filtrado por proveedor.",
  inputSchema: z.object({
    viernesPago: z
      .string()
      .describe("Fecha del viernes de pago de esa semana, formato YYYY-MM-DD"),
    proveedor: z
      .string()
      .optional()
      .describe("Opcional: filtra además por proveedor (nombre o parte del nombre)"),
  }),
  execute: async ({ viernesPago, proveedor }) => {
    try {
      const { rows, fileName } = await loadSapRows();
      let matches = getInvoicesDueByFriday(rows, viernesPago);
      if (proveedor) {
        const q = proveedor.toLowerCase();
        matches = matches.filter((r) => r.vendorName.toLowerCase().includes(q));
      }
      return { archivo: fileName, ...summarizeInvoices(matches) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "No se pudo leer el archivo SAP." };
    }
  },
});

export const sapFacturasPendientesTool = tool({
  description:
    "Busca en el archivo SAP más reciente las facturas de un proveedor cuyo flujo de aprobación NO ha terminado (WF Step Description distinto de 'WF finished'). Úsala cuando pregunten qué facturas están pendientes de liberar/aprobar de un proveedor.",
  inputSchema: z.object({
    proveedor: z.string().describe("Nombre (o parte del nombre) del proveedor"),
  }),
  execute: async ({ proveedor }) => {
    try {
      const { rows, fileName } = await loadSapRows();
      const matches = getPendingInvoices(rows, proveedor);
      return { archivo: fileName, ...summarizeInvoices(matches) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "No se pudo leer el archivo SAP." };
    }
  },
});
