import { tool } from "ai";
import { z } from "zod";
import { recommendFilament } from "@/lib/tools/filament-data";

export const filamentRecommenderTool = tool({
  description:
    "Recomienda el filamento más adecuado (PLA, PETG, ASA, TPU) para una pieza o diseño específico, con temperaturas y ajustes de partida en Bambu Studio. Úsala cuando el usuario pregunte qué filamento usar para una pieza, diseño o proyecto nuevo.",
  inputSchema: z.object({
    tipoPieza: z
      .string()
      .describe("Qué es la pieza, ej. 'florero decorativo', 'soporte de celular', 'engranaje'"),
    usoPrincipal: z
      .string()
      .optional()
      .describe("Para qué se va a usar, ej. 'decoración interior', 'uso diario exterior'"),
    acabadoDeseado: z.enum(["mate", "glossy", "silk", "translucido"]).optional(),
    exterior: z.boolean().optional().describe("Si la pieza estará expuesta a sol/intemperie"),
    esfuerzoMecanico: z
      .enum(["bajo", "medio", "alto"])
      .optional()
      .describe("Qué tanto esfuerzo/impacto mecánico debe soportar la pieza"),
    flexible: z.boolean().optional().describe("Si necesita ser flexible/elástica"),
  }),
  execute: async (input) => {
    const [top, ...resto] = recommendFilament(input);

    return {
      recomendacion: {
        material: top.profile.material,
        por_que: top.reasons.length ? top.reasons : ["Mejor balance disponible para lo descrito."],
        ajustes_bambu_studio: {
          nozzle: top.profile.nozzle,
          cama: top.profile.cama,
          ventilacion: top.profile.ventilacion,
        },
        notas: top.profile.notas,
      },
      alternativas: resto
        .filter((a) => a.score > 0)
        .slice(0, 2)
        .map((a) => ({ material: a.profile.material, notas: a.profile.notas })),
    };
  },
});
