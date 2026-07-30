import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
} from "ai";
import { MAKER_SYSTEM_PROMPT, makerAgentTools } from "./agent";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-flash-latest"),
    system: MAKER_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: makerAgentTools,
  });

  return result.toUIMessageStreamResponse();
}
