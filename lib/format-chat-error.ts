export function formatChatError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("credit card") || message.includes("AI Gateway")) {
    return "AI Gateway pide tarjeta en Vercel. Quita AI_GATEWAY_API_KEY de .env.local o añade tarjeta en vercel.com → AI.";
  }

  if (
    message.includes("UNAUTHENTICATED") ||
    message.includes("OAuth") ||
    message.includes("ACCESS_TOKEN")
  ) {
    return "Tu key de Google (AQ...) no funciona con esta API todavía. Solución más fácil: en Vercel → AI Gateway → añade tarjeta (créditos gratis) y usa AI_GATEWAY_API_KEY. Alternativa: en aistudio.google.com/apikey busca una key tipo Standard (AIza).";
  }

  return "No se pudo conectar con Gemini. Revisa la API key en .env.local.";
}
