import { convertToModelMessages, streamText, UIMessage } from "ai";
import { formatChatError } from "@/lib/format-chat-error";
import { getDesignModel } from "@/lib/chat-model";
import { DESIGN_SYSTEM_PROMPT } from "./agent";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: getDesignModel(),
    system: DESIGN_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({ onError: formatChatError });
}
