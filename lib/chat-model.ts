import { google } from "@ai-sdk/google";
import { gateway } from "@ai-sdk/gateway";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

function resolveGoogleModel(modelId: string) {
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (googleKey) {
    // Google auth keys (AQ.) use the Interactions API; standard keys (AIza) use generateContent.
    if (googleKey.startsWith("AQ.")) {
      return google.interactions(modelId);
    }
    return google(modelId);
  }

  if (process.env.AI_GATEWAY_API_KEY) {
    return gateway(`google/${modelId}`);
  }

  return google(modelId);
}

/** Gemini with vision (photos). Prefers AI Studio key; AI Gateway needs a Vercel card on file. */
export function getChatModel() {
  return resolveGoogleModel(GEMINI_MODEL);
}

/** Gemini con salida de imagen: genera renders como parte de la respuesta multimodal. */
export function getDesignModel() {
  return resolveGoogleModel(GEMINI_IMAGE_MODEL);
}
