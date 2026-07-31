import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
} from "ai";
import { formatChatError } from "@/lib/format-chat-error";
import { getChatModel } from "@/lib/chat-model";
import { MAKER_SYSTEM_PROMPT, makerAgentTools } from "./agent";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: getChatModel(),
    system: MAKER_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: makerAgentTools,
  });

  return result.toUIMessageStreamResponse({ onError: formatChatError });
}
