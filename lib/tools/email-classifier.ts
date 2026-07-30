import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { GmailMessageSummary } from "@/lib/gmail";

export const CATEGORIES = [
  "mencion_directa",
  "portal_proveedores",
  "solicitud_pago",
  "factura_pagada",
  "proxima_a_pagar",
  "nota_credito",
  "informativo",
  "otro",
] as const;

const classificationSchema = z.object({
  clasificaciones: z.array(
    z.object({
      id: z.string(),
      categoria: z.enum(CATEGORIES),
      requiere_atencion: z.boolean(),
      resumen: z.string().describe("Resumen de una línea del correo"),
    }),
  ),
});

export type EmailClassification = z.infer<
  typeof classificationSchema
>["clasificaciones"][number];

export async function classifyEmails(
  emails: GmailMessageSummary[],
): Promise<EmailClassification[]> {
  if (emails.length === 0) return [];

  const { output } = await generateText({
    model: google("gemini-flash-latest"),
    output: Output.object({ schema: classificationSchema }),
    prompt: `Eres el asistente de Cristian, un contador público que gestiona la cuenta de correo del cliente "Baltimore".

Clasifica cada correo en UNA categoría:

- mencion_directa: mencionan a "Cristian" o "Cris" por nombre (o variantes como "Christian"), piden ayuda directamente ("puedes ayudarme", "apoyo", "apóyanos"), o usan tono de problema/urgencia ("urgente", "problema", "pendiente"). También aplica cuando comparten facturas por vencer y piden que se gestione/apoye el pago para una fecha puntual (ej. "Hola Cristian, te comparto las facturas que vencen esta semana, apóyanos con el pago para este viernes"). Tiene prioridad sobre las demás categorías si aplica.
- portal_proveedores: cualquier correo relacionado con el portal de proveedores (registro, invitación, actualización de datos, solicitud de acceso, notificaciones del portal). Siempre es importante, incluso si parece informativo.
- solicitud_pago: piden el detalle o integración/cruce de un pago (ej. "solicitud integración de pagos", "envíame el soporte de pago"). Cristian debe buscar en SAP por fecha de pago y responder con el detalle.
- factura_pagada: preguntan directamente si una factura específica ya fue pagada, o piden confirmación de que se pagó.
- proxima_a_pagar: preguntan por fechas de próximos pagos o vencimientos.
- nota_credito: envían o hacen referencia a una nota de crédito.
- informativo: NO requiere acción. Correos que solo AVISAN algo sin pedir nada de vuelta: "envío factura con evidencia", "programación de pago" (como aviso, no como pregunta), confirmaciones automáticas, copias FYI, notificaciones del sistema.
- otro: cualquier otro caso que no encaje arriba.

Regla clave para decidir informativo vs. accionable: si el correo solo INFORMA que algo se hizo o se envió, es informativo. Si el correo PIDE algo (información, un detalle, confirmación, ayuda), es una categoría accionable.

requiere_atencion = true para todas las categorías excepto "informativo" y "otro". "portal_proveedores" siempre es true.

Si el correo menciona una fecha límite o de vencimiento, inclúyela en el resumen (ej. "vence este viernes").

Correos:
${emails
  .map((e) => `id: ${e.id}\nDe: ${e.from}\nAsunto: ${e.subject}\nExtracto: ${e.snippet}`)
  .join("\n---\n")}`,
  });

  return output.clasificaciones;
}
