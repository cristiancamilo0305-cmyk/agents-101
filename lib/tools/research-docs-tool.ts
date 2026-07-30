import { tool } from "ai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export function createResearchDocsTool(relativePath: string, description: string) {
  return tool({
    description,
    inputSchema: z.object({
      query: z
        .string()
        .describe("Descripción corta de qué está buscando el agente"),
    }),
    execute: async ({ query }) => {
      const filePath = path.join(process.cwd(), relativePath);
      try {
        const content = await readFile(filePath, "utf-8");
        return { query, content };
      } catch (err) {
        const error =
          err instanceof Error ? err.message : `No se pudo leer ${relativePath}`;
        return { query, error };
      }
    },
  });
}
