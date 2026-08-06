"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GmailMessageSummary } from "@/lib/gmail";
import type { EmailClassification } from "@/lib/tools/email-classifier";

type TriageResult = GmailMessageSummary &
  Partial<EmailClassification> & {
    importante?: boolean;
    borrador?: { id: string; preview: string };
  };

const CATEGORY_STYLES: Record<
  string,
  { label: string; badge: string; border: string; icon: string }
> = {
  mencion_directa: {
    label: "Te mencionan",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    border: "border-l-rose-500",
    icon: "📣",
  },
  portal_proveedores: {
    label: "Portal de proveedores",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    border: "border-l-purple-500",
    icon: "🔐",
  },
  solicitud_pago: {
    label: "Solicitud de pago (SAP)",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    border: "border-l-amber-500",
    icon: "💳",
  },
  factura_pagada: {
    label: "Factura pagada",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    border: "border-l-emerald-500",
    icon: "✅",
  },
  proxima_a_pagar: {
    label: "Próximo pago",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    border: "border-l-blue-500",
    icon: "📅",
  },
  nota_credito: {
    label: "Nota de crédito",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    border: "border-l-teal-500",
    icon: "🧾",
  },
  informativo: {
    label: "Informativo",
    badge: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
    border: "border-l-gray-300",
    icon: "ℹ️",
  },
  otro: {
    label: "Otro",
    badge: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
    border: "border-l-gray-300",
    icon: "📨",
  },
};

function styleFor(categoria: string | undefined) {
  return CATEGORY_STYLES[categoria ?? "otro"] ?? CATEGORY_STYLES.otro;
}

export default function BaltimoreGmailPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TriageResult[] | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/gmail/status")
      .then((res) => res.json())
      .then((data) => setConnected(data.connected));
  }, []);

  async function reviewInbox() {
    setLoading(true);
    setReviewError(null);
    try {
      const res = await fetch("/api/gmail/triage", { method: "POST" });
      if (!res.ok) {
        setReviewError("No se pudo revisar la bandeja. Intenta de nuevo.");
        return;
      }
      const data = await res.json();
      setResults(data.results);
    } catch {
      setReviewError("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function markNotRelevantAsRead() {
    if (!results) return;
    const ids = results.filter((r) => !r.requiere_atencion).map((r) => r.id);
    if (ids.length === 0) return;

    setMarking(true);
    setMarkError(null);
    const res = await fetch("/api/gmail/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setMarking(false);

    if (!res.ok) {
      setMarkError("No se pudo marcar como leídos. Intenta de nuevo.");
      return;
    }

    const { failed }: { failed: string[] } = await res.json();
    if (failed.length > 0) {
      setMarkError(
        `${failed.length} correo(s) no se pudieron marcar. Intenta de nuevo con esos.`,
      );
    }
    const succeededIds = ids.filter((id) => !failed.includes(id));
    setResults((prev) => prev?.filter((r) => !succeededIds.includes(r.id)) ?? null);
  }

  const attention = [...(results?.filter((r) => r.requiere_atencion) ?? [])].sort(
    (a, b) => Number(b.importante) - Number(a.importante),
  );
  const notRelevant = results?.filter((r) => !r.requiere_atencion) ?? [];

  return (
    <main className="flex min-h-screen flex-col items-center bg-foreground/[0.02] dark:bg-white/[0.02]">
      <div className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white shadow-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/70">Baltimore</p>
            <h1 className="text-2xl font-semibold tracking-tight">Bandeja Gmail</h1>
          </div>
          <Link
            href="/consultoria/baltimore"
            className="shrink-0 rounded-md px-2 py-1 text-sm text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            ← Chat Baltimore
          </Link>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
        {connected === null && <p className="text-sm text-foreground/50">Cargando…</p>}

        {connected === false && (
          <a
            href="/api/auth/google"
            className="w-fit rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Conectar con Gmail
          </a>
        )}

        {connected && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <button
                onClick={reviewInbox}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Revisando…" : "Revisar bandeja"}
              </button>
              {results && (
                <span className="text-sm text-foreground/50">
                  {attention.length} requieren atención · {notRelevant.length} no relevantes
                </span>
              )}
            </div>
            {reviewError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                {reviewError}
              </p>
            )}

            {results && (
              <div className="flex flex-col gap-8">
                <section className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
                    Requieren tu atención ({attention.length})
                  </h2>
                  {attention.length === 0 && (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      Nada pendiente 🎉
                    </p>
                  )}
                  {attention.map((r) => {
                    const style = styleFor(r.categoria);
                    return (
                      <div
                        key={r.id}
                        className={`rounded-lg border bg-background p-3 text-sm shadow-sm ${
                          r.importante
                            ? "border-red-300 border-l-4 border-l-red-500 ring-1 ring-red-200 dark:border-red-500/30 dark:ring-red-500/20"
                            : `border-foreground/10 border-l-4 ${style.border}`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{r.subject || "(sin asunto)"}</span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {r.importante && (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                                🔴 Importante
                              </span>
                            )}
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}
                            >
                              {style.icon} {style.label}
                            </span>
                          </div>
                        </div>
                        <p className="text-foreground/60">{r.from}</p>
                        <p className="mt-1 text-foreground/80">{r.resumen}</p>
                        {r.borrador && (
                          <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              📝 Borrador de respuesta listo en Gmail — revísalo antes de enviarlo
                            </p>
                            <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-foreground/70">
                              {r.borrador.preview}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>

                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
                      No relevantes ({notRelevant.length})
                    </h2>
                    {notRelevant.length > 0 && (
                      <button
                        onClick={markNotRelevantAsRead}
                        disabled={marking}
                        className="rounded-lg border border-blue-600 px-3 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                      >
                        {marking ? "Marcando…" : "Marcar todos como leídos"}
                      </button>
                    )}
                  </div>
                  {markError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                      {markError}
                    </p>
                  )}
                  {notRelevant.map((r) => {
                    const style = styleFor(r.categoria);
                    return (
                      <p key={r.id} className="text-sm text-foreground/50">
                        {r.subject || "(sin asunto)"} — {r.from}{" "}
                        <span className={`rounded-full px-2 py-0.5 text-xs ${style.badge}`}>
                          {style.icon} {style.label}
                        </span>
                      </p>
                    );
                  })}
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
