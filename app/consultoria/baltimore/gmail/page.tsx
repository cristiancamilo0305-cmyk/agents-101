"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GmailMessageSummary } from "@/lib/gmail";
import type { EmailClassification } from "@/lib/tools/email-classifier";

type TriageResult = GmailMessageSummary & Partial<EmailClassification>;

const CATEGORY_LABELS: Record<string, string> = {
  mencion_directa: "Te mencionan",
  portal_proveedores: "Portal de proveedores",
  solicitud_pago: "Solicitud de pago (SAP)",
  factura_pagada: "Factura pagada",
  proxima_a_pagar: "Próximo pago",
  nota_credito: "Nota de crédito",
  informativo: "Informativo",
  otro: "Otro",
};

export default function BaltimoreGmailPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TriageResult[] | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/gmail/status")
      .then((res) => res.json())
      .then((data) => setConnected(data.connected));
  }, []);

  async function reviewInbox() {
    setLoading(true);
    const res = await fetch("/api/gmail/triage", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResults(data.results);
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

  const attention = results?.filter((r) => r.requiere_atencion) ?? [];
  const notRelevant = results?.filter((r) => !r.requiere_atencion) ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Baltimore — Bandeja Gmail</h1>
        <Link
          href="/consultoria/baltimore"
          className="shrink-0 text-sm underline text-foreground/70"
        >
          ← Chat Baltimore
        </Link>
      </div>

      {connected === null && <p className="text-sm text-foreground/50">Cargando…</p>}

      {connected === false && (
        <a
          href="/api/auth/google"
          className="w-fit rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Conectar con Gmail
        </a>
      )}

      {connected && (
        <div className="flex flex-col gap-6">
          <button
            onClick={reviewInbox}
            disabled={loading}
            className="w-fit rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {loading ? "Revisando…" : "Revisar bandeja"}
          </button>

          {results && (
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-foreground/70">
                  Requieren tu atención ({attention.length})
                </h2>
                {attention.length === 0 && (
                  <p className="text-sm text-foreground/50">Nada pendiente 🎉</p>
                )}
                {attention.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-foreground/10 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{r.subject || "(sin asunto)"}</span>
                      <span className="shrink-0 rounded bg-foreground/10 px-2 py-0.5 text-xs">
                        {CATEGORY_LABELS[r.categoria ?? "otro"]}
                      </span>
                    </div>
                    <p className="text-foreground/60">{r.from}</p>
                    <p className="mt-1 text-foreground/80">{r.resumen}</p>
                  </div>
                ))}
              </section>

              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground/70">
                    No relevantes ({notRelevant.length})
                  </h2>
                  {notRelevant.length > 0 && (
                    <button
                      onClick={markNotRelevantAsRead}
                      disabled={marking}
                      className="rounded-lg border border-foreground/20 px-3 py-1 text-xs font-medium disabled:opacity-50"
                    >
                      {marking ? "Marcando…" : "Marcar todos como leídos"}
                    </button>
                  )}
                </div>
                {markError && <p className="text-sm text-red-600">{markError}</p>}
                {notRelevant.map((r) => (
                  <p key={r.id} className="text-sm text-foreground/50">
                    {r.subject || "(sin asunto)"} — {r.from}{" "}
                    <span className="text-foreground/30">
                      [{CATEGORY_LABELS[r.categoria ?? "otro"]}]
                    </span>
                  </p>
                ))}
              </section>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
