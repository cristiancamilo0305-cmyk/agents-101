"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { useEffect, useRef, useState } from "react";
import type { MakerChatUIMessage } from "@/app/api/chat/maker/agent";

const MAX_FILE_MB = 5;

type MakerChatPanelProps = {
  title: string;
  api: string;
  description?: string;
  placeholder?: string;
  defaultPrompt?: string;
};

export function MakerChatPanel({
  title,
  api,
  description = "Sube una foto de tu pieza impresa para diagnóstico visual + ajustes en Bambu Studio.",
  placeholder = "Describe el filamento o el problema…",
  defaultPrompt = "Analiza esta foto de mi impresión 3D. Identifica el defecto y dime qué ajustar en Bambu Studio (temperaturas, velocidades, seam, ventilación, etc.).",
}: MakerChatPanelProps) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status, error } = useChat<MakerChatUIMessage>({
    transport: new DefaultChatTransport({ api }),
  });

  useEffect(() => {
    if (!files?.[0]) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(files[0]);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [files]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const selected = event.target.files;
    if (!selected?.[0]) {
      setFiles(undefined);
      return;
    }
    const file = selected[0];
    const isImage =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if (!isImage) {
      setFileError("Solo imágenes (JPG, PNG, WEBP). En iPhone, usa “Más compatible” al exportar.");
      setFiles(undefined);
      event.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`Máximo ${MAX_FILE_MB} MB por foto.`);
      setFiles(undefined);
      event.target.value = "";
      return;
    }
    setFiles(selected);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text && !files?.length) return;

    const filesToSend = files;
    const prompt = text || defaultPrompt;

    try {
      await sendMessage({
        text: prompt,
        files: filesToSend,
      });
      setInput("");
      setFiles(undefined);
      setFileError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setFileError("No se pudo enviar. Intenta de nuevo.");
    }
  }

  const busy = status === "submitted" || status === "streaming";

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="flex w-full max-w-xl flex-1 flex-col gap-4 pb-36">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-foreground/60">{description}</p>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "self-end max-w-[95%] rounded-lg border border-foreground/10 bg-background/80 px-3 py-2 text-sm shadow-sm backdrop-blur-sm"
                  : "self-start max-w-[95%] rounded-lg border border-foreground/10 bg-background/60 px-3 py-2 text-sm shadow-sm backdrop-blur-sm"
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
                if (part.type === "file" && part.mediaType?.startsWith("image/")) {
                  return (
                    <img
                      key={`${message.id}-${i}`}
                      src={part.url}
                      alt={part.filename ?? "Foto impresión"}
                      className="mt-1 max-h-48 rounded-md border border-foreground/10 object-contain"
                    />
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
            <p className="self-start text-sm text-foreground/50">Analizando…</p>
          )}
        </div>

        {previewUrl && (
          <div className="fixed bottom-28 left-1/2 w-full max-w-xl -translate-x-1/2 px-4">
            <div className="flex items-center gap-2 rounded-lg border border-foreground/15 bg-background/90 p-2 shadow-md backdrop-blur-md">
              <img
                src={previewUrl}
                alt="Vista previa"
                className="h-14 w-14 rounded object-cover"
              />
              <span className="text-xs text-foreground/60">
                Foto lista — pulsa <strong>Enviar</strong>
              </span>
              <button
                type="button"
                className="ml-auto text-xs underline text-foreground/50"
                onClick={() => {
                  setFiles(undefined);
                  setFileError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Quitar
              </button>
            </div>
          </div>
        )}

        <form
          className="fixed bottom-0 left-0 flex w-full flex-col items-center gap-2 border-t border-foreground/10 bg-background/85 p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur-md"
          onSubmit={handleSubmit}
        >
          {fileError && (
            <p className="w-full max-w-xl text-sm text-red-600 dark:text-red-400">{fileError}</p>
          )}
          {error && (
            <p className="w-full max-w-xl text-sm text-red-600 dark:text-red-400">
              Error: {error.message}
            </p>
          )}
          <div className="flex w-full max-w-xl gap-2">
            <label className="flex shrink-0 cursor-pointer items-center rounded-lg border border-foreground/20 px-3 py-2 text-sm hover:bg-foreground/5">
              📷
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={busy}
                onChange={handleFileChange}
              />
            </label>
            <input
              className="min-w-0 flex-1 rounded-lg border border-foreground/20 px-3 py-2 text-sm shadow-sm"
              value={input}
              placeholder={placeholder}
              disabled={busy}
              onChange={(e) => setInput(e.currentTarget.value)}
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              disabled={busy || (!input.trim() && !files?.length)}
            >
              Enviar
            </button>
          </div>
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
