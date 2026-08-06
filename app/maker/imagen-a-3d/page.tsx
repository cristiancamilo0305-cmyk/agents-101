"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const MAX_FILE_MB = 15;
const POLL_INTERVAL_MS = 3000;

type Phase = "idle" | "uploading" | "generating" | "done" | "converting" | "stlDone" | "error";

export default function ImageToModelPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    import("@google/model-viewer");
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  function pollTask(id: string, onSuccess: (url: string) => void) {
    pollTimer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/maker/image-to-model/status/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error consultando el estado.");

        setProgress(data.progress ?? 0);

        if (data.status === "success") {
          if (pollTimer.current) clearInterval(pollTimer.current);
          onSuccess(data.modelUrl);
        } else if (data.status === "failed") {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setError("Tripo3D no pudo completar la tarea.");
          setPhase("error");
        }
      } catch (err) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setError(err instanceof Error ? err.message : "Error consultando el estado.");
        setPhase("error");
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setModelUrl(null);
    setStlUrl(null);
    setTaskId(null);
    setProgress(0);

    const isImage = /\.(jpe?g|png)$/i.test(file.name) || file.type === "image/jpeg" || file.type === "image/png";
    if (!isImage) {
      setError("Solo se aceptan imágenes JPEG o PNG.");
      setPhase("error");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Máximo ${MAX_FILE_MB} MB.`);
      setPhase("error");
      return;
    }

    setPhase("uploading");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/maker/image-to-model", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar la generación.");
      setTaskId(data.taskId);
      setPhase("generating");
      pollTask(data.taskId, (url) => {
        setModelUrl(url);
        setPhase("done");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la generación.");
      setPhase("error");
    }
  }

  async function handleExportStl() {
    if (!taskId) return;
    setError(null);
    setProgress(0);
    setPhase("converting");

    try {
      const res = await fetch("/api/maker/image-to-model/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar la conversión.");
      pollTask(data.taskId, (url) => {
        setStlUrl(url);
        setPhase("stlDone");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la conversión.");
      setPhase("error");
    }
  }

  const showViewer = modelUrl && (phase === "done" || phase === "converting" || phase === "stlDone");
  const proxiedModelUrl = modelUrl ? `/api/maker/image-to-model/proxy?url=${encodeURIComponent(modelUrl)}` : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Imagen → Modelo 3D</h1>
      <p className="text-sm text-foreground/60">
        Sube una foto de referencia (fondo limpio, un solo objeto) y genera un modelo 3D con Tripo3D. Usa una API de
        pago por generación (~$0.30 USD c/u) — necesitas tu propia API key en <code>TRIPO3D_API_KEY</code>.
      </p>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-foreground/25 bg-background/60 p-8 text-center text-sm text-foreground/60 shadow-sm backdrop-blur-sm transition-colors hover:bg-background/80">
        <span>🖼️ Selecciona una foto (JPEG o PNG)</span>
        <input
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          disabled={phase === "uploading" || phase === "generating" || phase === "converting"}
          onChange={handleFileChange}
        />
      </label>

      {phase === "uploading" && <p className="text-sm text-foreground/50">Subiendo imagen a Tripo3D…</p>}
      {phase === "generating" && <p className="text-sm text-foreground/50">Generando modelo 3D… {progress}%</p>}
      {phase === "converting" && (
        <p className="text-sm text-foreground/50">Convirtiendo a STL… {progress}%</p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-700 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {showViewer && (
        <div className="flex flex-col gap-3 rounded-xl border border-foreground/15 bg-background/70 p-4 shadow-sm backdrop-blur-sm">
          <model-viewer
            src={proxiedModelUrl}
            alt="Modelo 3D generado"
            camera-controls="true"
            auto-rotate="true"
            shadow-intensity="1"
            style={{ width: "100%", height: "360px", background: "transparent" }}
          />
          <p className="text-xs text-foreground/50">Arrastra para rotar, scroll para hacer zoom.</p>

          <div className="flex flex-wrap gap-2">
            <a
              href={modelUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
            >
              Descargar .glb
            </a>
            {phase === "done" && (
              <button
                type="button"
                onClick={handleExportStl}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Exportar a STL
              </button>
            )}
          </div>

          {phase === "stlDone" && stlUrl && (
            <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-sm font-medium">✅ STL listo</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={stlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  Descargar .stl
                </a>
                <Link
                  href="/maker/stl"
                  className="w-fit rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
                >
                  Validar en Diagnóstico STL
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
