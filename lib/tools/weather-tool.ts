import { tool } from "ai";
import { z } from "zod";

export const weatherTool = tool({
  description: "Obtiene el clima actual de una ciudad",
  inputSchema: z.object({
    location: z.string().describe("La ciudad a consultar"),
  }),
  execute: async ({ location }) => {
    const temperature = Math.round(Math.random() * (35 - 10) + 10);
    return { location, temperature };
  },
});
