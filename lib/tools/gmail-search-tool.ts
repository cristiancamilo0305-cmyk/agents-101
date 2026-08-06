import { tool } from "ai";
import { z } from "zod";
import { getValidAccessToken } from "@/lib/gmail-auth";
import { searchMessages } from "@/lib/gmail";

export const gmailBuscarTool = tool({
  description:
    "Busca en TODO el correo de Baltimore (leído y no leído, no solo la bandeja de no leídos) usando sintaxis de búsqueda de Gmail. Ejemplos de query: 'from:fastenal', 'subject:factura', 'after:2026/07/01 before:2026/07/15', combinables con espacios. Úsala cuando pidan buscar algo en el correo en general, no solo triaje de no leídos.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Query de búsqueda de Gmail (operadores from:, subject:, after:, before:, etc., o texto libre)"),
    limite: z.number().optional().describe("Máximo de resultados, por defecto 15"),
  }),
  execute: async ({ query, limite }) => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return { error: "No hay una cuenta de Google conectada." };

    try {
      const results = await searchMessages(accessToken, query, limite ?? 15);
      return {
        totalEncontrados: results.length,
        resultados: results.map((r) => ({
          de: r.from,
          asunto: r.subject,
          fecha: r.date,
          extracto: r.snippet,
        })),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "No se pudo buscar en Gmail." };
    }
  },
});
