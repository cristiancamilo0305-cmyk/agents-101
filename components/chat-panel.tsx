"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import type { DynamicToolUIPart, ToolUIPart, UIDataTypes, UIMessage } from "ai";
import Link from "next/link";
import { useState } from "react";

type Accent = "neutral" | "blue";

const ACCENT_STYLES: Record<
  Accent,
  { header: string; button: string; userBubble: string; link: string; ring: string }
> = {
  neutral: {
    header: "bg-foreground",
    button: "bg-foreground text-background hover:opacity-90",
    userBubble: "bg-foreground/10",
    link: "text-foreground/70 hover:text-foreground",
    ring: "focus-visible:ring-foreground/40",
  },
  blue: {
    header: "bg-gradient-to-r from-blue-600 to-indigo-600",
    button: "bg-blue-600 text-white hover:bg-blue-700",
    userBubble: "bg-blue-600 text-white",
    link: "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
    ring: "focus-visible:ring-blue-500/50",
  },
};

type ChatPanelProps = {
  title: string;
  api: string;
  backHref?: string;
  backLabel?: string;
  headerLinks?: { href: string; label: string }[];
  accent?: Accent;
};

export function ChatPanel({
  title,
  api,
  backHref = "/",
  backLabel = "← Inicio",
  headerLinks = [],
  accent = "neutral",
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat<
    UIMessage<never, UIDataTypes, Record<string, never>>
  >({
    transport: new DefaultChatTransport({ api }),
  });
  const styles = ACCENT_STYLES[accent];

  return (
    <main className="flex min-h-screen flex-col items-center bg-foreground/[0.02] dark:bg-white/[0.02]">
      <div className={`w-full ${styles.header} px-8 py-6 text-white shadow-sm`}>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <Link
              href={backHref}
              className={`shrink-0 rounded-md px-2 py-1 text-sm text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 ${styles.ring}`}
            >
              {backLabel}
            </Link>
          </div>
          {headerLinks.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {headerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-2 py-1 text-sm text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 ${styles.ring}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full max-w-xl flex-1 flex-col gap-4 p-8 pb-24">
        <div className="flex flex-1 flex-col gap-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? `self-end rounded-lg px-3 py-2 text-sm shadow-sm ${styles.userBubble}`
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
          className="fixed bottom-0 left-0 flex w-full justify-center gap-2 border-t border-foreground/10 bg-background p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            sendMessage({ text: input });
            setInput("");
          }}
        >
          <input
            className={`w-full max-w-xl rounded-lg border border-foreground/20 px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 ${styles.ring}`}
            value={input}
            placeholder="Escribe un mensaje…"
            onChange={(e) => setInput(e.currentTarget.value)}
          />
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 ${styles.button}`}
            disabled={!input.trim()}
          >
            Enviar
          </button>
        </form>
      </div>
    </main>
  );
}

const SAP_TOOL_NAMES = new Set([
  "sap_detalle_pago",
  "sap_facturas_pendientes",
  "sap_facturas_semana",
  "sap_consulta",
]);

type SapFactura = {
  referencia: string;
  monto: number;
  moneda: string;
  estatus_wf: string;
  fecha_documento: string | null;
  fecha_vencimiento: string | null;
};

type SapVendorTotal = {
  proveedor: string;
  facturas: number;
  totales_por_moneda: Record<string, number>;
};

type SapToolOutput =
  | { archivo: string; facturas: SapFactura[]; totales_por_moneda: Record<string, number> }
  | { archivo: string; proveedores: SapVendorTotal[] }
  | { error: string };

function isSapOutput(output: unknown): output is SapToolOutput {
  if (!output || typeof output !== "object") return false;
  if ("error" in output) return typeof (output as { error: unknown }).error === "string";
  if (Array.isArray((output as { facturas?: unknown }).facturas)) return true;
  return Array.isArray((output as { proveedores?: unknown }).proveedores);
}

const money = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SapVendorRankingTable({ proveedores }: { proveedores: SapVendorTotal[] }) {
  if (proveedores.length === 0) {
    return <p className="text-xs text-foreground/50">Sin proveedores encontrados.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-foreground/10">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead className="bg-foreground/5 text-[10px] uppercase tracking-wide text-foreground/50">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Proveedor</th>
            <th className="px-3 py-2 font-medium">Facturas</th>
            <th className="px-3 py-2 font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/10">
          {proveedores.map((v, i) => (
            <tr key={v.proveedor}>
              <td className="px-3 py-2 text-foreground/40">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{v.proveedor}</td>
              <td className="px-3 py-2">{v.facturas}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {Object.entries(v.totales_por_moneda)
                  .map(([currency, amount]) => `${money.format(amount)} ${currency}`)
                  .join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SapTable({ output }: { output: SapToolOutput }) {
  if ("error" in output) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
        {output.error}
      </p>
    );
  }

  if ("proveedores" in output) {
    return <SapVendorRankingTable proveedores={output.proveedores} />;
  }

  if (output.facturas.length === 0) {
    return <p className="text-xs text-foreground/50">Sin facturas encontradas.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-foreground/10">
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead className="bg-foreground/5 text-[10px] uppercase tracking-wide text-foreground/50">
          <tr>
            <th className="px-3 py-2 font-medium">Factura</th>
            <th className="px-3 py-2 font-medium">Monto</th>
            <th className="px-3 py-2 font-medium">Estatus</th>
            <th className="px-3 py-2 font-medium">Fecha doc.</th>
            <th className="px-3 py-2 font-medium">Vencimiento</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/10">
          {output.facturas.map((f) => (
            <tr key={f.referencia}>
              <td className="px-3 py-2 font-medium">{f.referencia}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {money.format(f.monto)} {f.moneda}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    f.estatus_wf === "WF finished"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  {f.estatus_wf}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-foreground/60">
                {f.fecha_documento ?? "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-foreground/60">
                {f.fecha_vencimiento ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
        {Object.keys(output.totales_por_moneda).length > 0 && (
          <tfoot className="border-t border-foreground/10 bg-foreground/5 font-medium">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2" colSpan={4}>
                {Object.entries(output.totales_por_moneda)
                  .map(([currency, amount]) => `${money.format(amount)} ${currency}`)
                  .join(" · ")}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

type SatResultado = {
  uuid: string;
  uuid_relacionado: string | null;
  emisor: string;
  estatus_sat: string;
  total: number;
  moneda: string;
  pagado: string;
  fecha_expedicion: string | null;
};

type SatToolOutput = { archivo: string; resultados: SatResultado[] } | { error: string };

function isSatOutput(output: unknown): output is SatToolOutput {
  if (!output || typeof output !== "object") return false;
  if ("error" in output) return typeof (output as { error: unknown }).error === "string";
  return Array.isArray((output as { resultados?: unknown }).resultados);
}

function SatTable({ output }: { output: SatToolOutput }) {
  if ("error" in output) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
        {output.error}
      </p>
    );
  }

  if (output.resultados.length === 0) {
    return <p className="text-xs text-foreground/50">Ningún CFDI encontrado con ese UUID.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-foreground/10">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead className="bg-foreground/5 text-[10px] uppercase tracking-wide text-foreground/50">
          <tr>
            <th className="px-3 py-2 font-medium">UUID</th>
            <th className="px-3 py-2 font-medium">Emisor</th>
            <th className="px-3 py-2 font-medium">Estatus SAT</th>
            <th className="px-3 py-2 font-medium">Total</th>
            <th className="px-3 py-2 font-medium">Pagado</th>
            <th className="px-3 py-2 font-medium">Expedición</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/10">
          {output.resultados.map((r) => (
            <tr key={r.uuid}>
              <td className="px-3 py-2 font-mono text-[10px]">{r.uuid}</td>
              <td className="px-3 py-2 font-medium">{r.emisor}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    r.estatus_sat.toLowerCase() === "vigente"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                  }`}
                >
                  {r.estatus_sat}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {money.format(r.total)} {r.moneda}
              </td>
              <td className="px-3 py-2">{r.pagado}</td>
              <td className="whitespace-nowrap px-3 py-2 text-foreground/60">
                {r.fecha_expedicion ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolCallBlock({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const toolName = getToolName(part);
  const sapOutput =
    SAP_TOOL_NAMES.has(toolName) && part.state === "output-available" && isSapOutput(part.output)
      ? part.output
      : null;
  const satOutput =
    toolName === "sat_consulta_uuid" && part.state === "output-available" && isSatOutput(part.output)
      ? part.output
      : null;

  return (
    <div className="mt-1 space-y-2">
      {sapOutput && <SapTable output={sapOutput} />}
      {satOutput && <SatTable output={satOutput} />}
      <details className="group rounded-md border border-foreground/15 bg-background text-xs">
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
    </div>
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
