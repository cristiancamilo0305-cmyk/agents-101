"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import type { DynamicToolUIPart, ToolUIPart, UIDataTypes, UIMessage } from "ai";
import Link from "next/link";
import { useState } from "react";

type ChatPanelProps = {
  title: string;
  api: string;
  backHref?: string;
  backLabel?: string;
  headerLinks?: { href: string; label: string }[];
};

export function ChatPanel({
  title,
  api,
  backHref = "/",
  backLabel = "← Inicio",
  headerLinks = [],
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat<
    UIMessage<never, UIDataTypes, Record<string, never>>
  >({
    transport: new DefaultChatTransport({ api }),
  });

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="flex w-full max-w-xl flex-1 flex-col gap-4 pb-24">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <Link href={backHref} className="shrink-0 text-sm underline text-foreground/70">
              {backLabel}
            </Link>
          </div>
          {headerLinks.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {headerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm underline text-foreground/70"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "self-end rounded-lg bg-foreground/10 px-3 py-2 text-sm"
                  : "self-start rounded-lg bg-foreground/5 px-3 py-2 text-sm"
              }
            >
              {message.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <span key={`${message.id}-${i}`} className="whitespace-pre-wrap">
                      {part.text}
                    </span>
                  );
                }
                if (isToolUIPart(part)) {
                  return <ToolCallBlock key={`${message.id}-${i}`} part={part} />;
                }
                return null;
              })}
            </div>
          ))}
          {status === "submitted" && (
            <p className="self-start text-sm text-foreground/50">Pensando…</p>
          )}
        </div>

        <form
          className="fixed bottom-0 left-0 flex w-full justify-center gap-2 bg-background p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            sendMessage({ text: input });
            setInput("");
          }}
        >
          <input
            className="w-full max-w-xl rounded-lg border border-foreground/20 px-3 py-2 text-sm shadow-sm"
            value={input}
            placeholder="Escribe un mensaje…"
            onChange={(e) => setInput(e.currentTarget.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            disabled={!input.trim()}
          >
            Enviar
          </button>
        </form>
      </div>
    </main>
  );
}

function ToolCallBlock({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const toolName = getToolName(part);

  return (
    <details className="group mt-1 rounded-md border border-foreground/15 bg-background text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 py-1.5 font-medium [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40">
        <span>🔧 {toolName}</span>
        <span className="flex items-center gap-1 text-foreground/50">
          {toolStateLabel(part.state)}
          <span
            aria-hidden="true"
            className="inline-block transition-transform group-open:rotate-90"
          >
            ▶
          </span>
        </span>
      </summary>
      <div className="space-y-2 border-t border-foreground/10 px-2 py-2">
        {part.input !== undefined && (
          <div>
            <p className="font-medium uppercase tracking-wide text-foreground/40">Input</p>
            <pre className="overflow-x-auto rounded bg-foreground/5 p-2">
              {JSON.stringify(part.input, null, 2)}
            </pre>
          </div>
        )}
        {part.state === "output-available" && (
          <div>
            <p className="font-medium uppercase tracking-wide text-foreground/40">Output</p>
            <pre className="overflow-x-auto rounded bg-foreground/5 p-2">
              {JSON.stringify(part.output, null, 2)}
            </pre>
          </div>
        )}
        {part.state === "output-error" && (
          <p className="text-red-600 dark:text-red-400">Error: {part.errorText}</p>
        )}
      </div>
    </details>
  );
}

function toolStateLabel(state: ToolUIPart["state"] | DynamicToolUIPart["state"]) {
  switch (state) {
    case "input-streaming":
      return "Preparando…";
    case "input-available":
      return "Ejecutando…";
    case "output-available":
      return "Completado";
    case "output-error":
      return "Error";
    default:
      return state;
  }
}
