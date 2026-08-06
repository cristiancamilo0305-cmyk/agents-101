import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { GmailMessageSummary } from "@/lib/gmail";

const IMPORTANT_KEYWORDS = ["returned payments", "saldo a favor", "pago doble", "devolucion"];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function hasImportantKeyword(email: Pick<GmailMessageSummary, "subject" | "snippet">): boolean {
  const haystack = normalize(`${email.subject} ${email.snippet}`);
  return IMPORTANT_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

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
      necesita_detalle_pago: z
        .boolean()
        .optional()
        .describe(
          "true si, sin importar la categoria asignada, el correo en el fondo pide saber qué facturas corresponden a un pago, concilar un pago recibido, o el detalle/desglose de un pago ya hecho (ej. 'conciliación de pago', 'no sé a qué facturas corresponde este pago', 'apóyanos a identificar el pago')",
        ),
      proveedor: z
        .string()
        .optional()
        .describe(
          "Solo si necesita_detalle_pago es true: nombre del proveedor del que piden el detalle del pago. Si no se nombra explícitamente en el cuerpo, infiérelo de quién envía el correo (su empresa, por dominio o firma) cuando sea razonable",
        ),
      fecha_pago: z
        .string()
        .optional()
        .describe(
          "Solo si necesita_detalle_pago es true: fecha del pago en formato YYYY-MM-DD. Resuelve fechas relativas ('ayer', 'la semana pasada', 'el lunes') usando la fecha del correo, no la de hoy",
        ),
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

  const hoy = new Date().toISOString().slice(0, 10);

  const { output } = await generateText({
    model: google("gemini-3.5-flash-lite"),
    output: Output.object({ schema: classificationSchema }),
    prompt: `Eres el asistente de Cristian, un contador público que gestiona la cuenta de correo del cliente "Baltimore".

Hoy es ${hoy}.

Clasifica cada correo en UNA categoría:

- mencion_directa: mencionan a "Cristian" o "Cris" por nombre (o variantes como "Christian"), piden ayuda directamente ("puedes ayudarme", "apoyo", "apóyanos", "ayuda", "help"), o usan tono de problema/urgencia en español o inglés ("urgente", "urgent", "urgent payment(s)", "pago urgente", "problema", "pendiente", "asap"). También aplica cuando comparten facturas por vencer y piden que se gestione/apoye el pago para una fecha puntual (ej. "Hola Cristian, te comparto las facturas que vencen esta semana, apóyanos con el pago para este viernes"). Tiene prioridad sobre las demás categorías si aplica.
- portal_proveedores: cualquier correo relacionado con el portal de proveedores (registro, invitación, actualización de datos, solicitud de acceso, notificaciones del portal). Siempre es importante, incluso si parece informativo.
- solicitud_pago: PIDEN o NECESITAN el detalle, desglose o integración/cruce de un pago (ej. "solicitud integración de pagos", "envíame el soporte de pago", "desglose de pago", "detalle del pago", "necesito el detalle de pago"). Cristian debe buscar en SAP por fecha de pago y responder con el detalle. NO aplica si es una respuesta donde ya se envió el detalle y solo agradecen o confirman recibido (ej. "gracias", "recibido", "ya quedó", "perfecto, gracias") — eso es informativo, el tema ya está cerrado.
- factura_pagada: preguntan directamente si una factura específica ya fue pagada, o piden confirmación de que se pagó.
- proxima_a_pagar: preguntan por fechas de próximos pagos o vencimientos.
- nota_credito: envían o hacen referencia a una nota de crédito.
- informativo: NO requiere acción. Correos que solo AVISAN algo sin pedir nada de vuelta: "envío factura con evidencia", "programación de pago" (como aviso, no como pregunta), confirmaciones automáticas, copias FYI, notificaciones del sistema.
- otro: cualquier otro caso que no encaje arriba.

Regla clave para decidir informativo vs. accionable: si el correo solo INFORMA que algo se hizo o se envió, es informativo. Si el correo PIDE algo (información, un detalle, confirmación, ayuda), es una categoría accionable.

requiere_atencion = true para todas las categorías excepto "informativo" y "otro". "portal_proveedores" siempre es true.

Si el correo menciona una fecha límite o de vencimiento, inclúyela en el resumen (ej. "vence este viernes").

necesita_detalle_pago es independiente de la categoria: márcalo true cada vez que el correo, sin importar si quedó como solicitud_pago, mencion_directa u otra, esté en el fondo pidiendo conciliar un pago, pidiendo la relación/lista de facturas de un pago, o adjuntando comprobante(s) de un pago ya hecho. Frases que SIEMPRE disparan esto (en español o inglés, con variaciones de tiempo/persona/redacción): "recibí este pago" / "recibimos este pago" / "recibimos un pago" / "received this payment" / "conciliación de pago" / "no sabemos a qué corresponde este pago" / "apóyanos a identificar este pago" / "a qué facturas corresponde" / "adjunto comprobante(s)" / "adjunta comprobante(s)" / "me apoyas con la relación de fact[uras]" / "relación de facturas" / "relación de fact". Cuando necesita_detalle_pago = true, llena "proveedor" y "fecha_pago" siempre que puedas resolverlos con confianza razonable:
- proveedor: si no está escrito por nombre en el cuerpo, infiérelo de quién manda el correo (nombre de empresa en el dominio del correo o en la firma) — SOLO si el remitente es una empresa externa. Si el remitente es una dirección interna de Baltimore Aircoil (@baltimoreaircoil.com), NUNCA pongas "Baltimore Aircoil" ni variantes como proveedor — esa es la propia empresa cliente, no un proveedor. En ese caso el proveedor real (un tercero) debe estar escrito explícitamente en el texto del correo; si no aparece, deja "proveedor" vacío aunque el resto de la info esté clara.
- fecha_pago: convierte fechas relativas ("ayer", "anteayer", "el lunes pasado") usando la FECHA DEL CORREO (no la fecha de hoy) como referencia, porque el correo pudo llegar hace días y seguir sin leerse.
Si de verdad no hay forma razonable de determinar alguno de los dos, déjalo vacío — no inventes un proveedor o fecha que no puedas sustentar.

Correos:
${emails
  .map(
    (e) =>
      `id: ${e.id}\nDe: ${e.from}\nFecha del correo: ${e.date}\nAsunto: ${e.subject}\nExtracto: ${e.snippet}`,
  )
  .join("\n---\n")}`,
  });

  return output.clasificaciones;
}

const paymentDetailsSchema = z.object({
  proveedor: z
    .string()
    .optional()
    .describe(
      "Proveedor externo (tercero) al que corresponde el pago. Nunca 'Baltimore Aircoil' — esa es la empresa cliente, no un proveedor.",
    ),
  fecha_pago: z
    .string()
    .optional()
    .describe("Fecha en que se recibió/liquidó el pago, formato YYYY-MM-DD"),
});

/**
 * Segundo intento cuando el snippet corto no trae proveedor/fecha (ej. avisos bancarios SPEI
 * donde el monto y la fecha del pago están más abajo en el cuerpo, no en el resumen de Gmail).
 */
export async function extractPaymentDetailsFromBody(
  email: Pick<GmailMessageSummary, "from" | "subject" | "date">,
  bodyText: string,
): Promise<{ proveedor?: string; fecha_pago?: string }> {
  const hoy = new Date().toISOString().slice(0, 10);

  const { output } = await generateText({
    model: google("gemini-3.5-flash-lite"),
    output: Output.object({ schema: paymentDetailsSchema }),
    prompt: `Eres el asistente de Cristian, contador de Baltimore. Lee el cuerpo completo de este correo (suele incluir avisos bancarios tipo SPEI con el monto y fecha del pago, además del mensaje escrito) y extrae, con confianza razonable:

- proveedor: a quién corresponde el pago (un tercero externo, nunca "Baltimore Aircoil").
- fecha_pago: la fecha en que se recibió/liquidó el pago (no la fecha de envío del correo), en YYYY-MM-DD. Resuelve fechas relativas contra la fecha del correo.

Si no puedes determinar alguno con confianza, déjalo vacío — no inventes.

De: ${email.from}
Fecha del correo: ${email.date}
Asunto: ${email.subject}
Hoy: ${hoy}

Cuerpo completo:
${bodyText}`,
  });

  return output;
}
