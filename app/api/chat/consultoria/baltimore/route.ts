import { formatChatError } from "@/lib/format-chat-error";
import { getChatModel } from "@/lib/chat-model";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
} from "ai";
import { BALTIMORE_SYSTEM_PROMPT, baltimoreAgentTools } from "./agent";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: getChatModel(),
    system: BALTIMORE_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: baltimoreAgentTools,
  });

  return result.toUIMessageStreamResponse({ onError: formatChatError });
}
