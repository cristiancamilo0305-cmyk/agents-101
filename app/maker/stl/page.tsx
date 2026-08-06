"use client";

import { useState } from "react";
import type { StlReport } from "@/lib/stl/analyze-stl";

const MAX_FILE_MB = 50;

export default function StlDiagnosisPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<StlReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setReport(null);
    setError(null);

    if (!file) {
      setFileName(null);
      return;
    }
    if (!/\.stl$/i.test(file.name)) {
      setError("Solo se aceptan archivos .stl");
      setFileName(null);
      event.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Máximo ${MAX_FILE_MB} MB por archivo.`);
      setFileName(null);
      event.target.value = "";
      return;
    }

    setFileName(file.name);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/maker/stl-diagnostico", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo analizar el archivo.");
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo analizar el archivo.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Diagnóstico de STL</h1>
      <p className="text-sm text-foreground/60">
        Sube un archivo .stl y revisa agujeros, geometría no-manifold y si cabe en tu impresora antes de llevarlo a
        Bambu Studio.
      </p>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-foreground/25 bg-background/60 p-8 text-center text-sm text-foreground/60 shadow-sm backdrop-blur-sm transition-colors hover:bg-background/80">
        <span>📐 {fileName ?? "Selecciona un archivo .stl"}</span>
        <input type="file" accept=".stl" className="sr-only" disabled={loading} onChange={handleFileChange} />
      </label>

      {loading && <p className="text-sm text-foreground/50">Analizando malla…</p>}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-700 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {report && <StlReportCard report={report} />}
    </main>
  );
}

function StlReportCard({ report }: { report: StlReport }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-foreground/15 bg-background/70 p-5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${report.isWatertight ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span className="font-medium">
          {report.isWatertight ? "Malla cerrada (watertight)" : "Se encontraron problemas de malla"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-foreground/50">Triángulos</dt>
        <dd>{report.triangles.toLocaleString()}</dd>
        <dt className="text-foreground/50">Dimensiones (mm)</dt>
        <dd>
          {report.boundingBoxMm.x.toFixed(1)} × {report.boundingBoxMm.y.toFixed(1)} ×{" "}
          {report.boundingBoxMm.z.toFixed(1)}
        </dd>
        <dt className="text-foreground/50">Volumen estimado</dt>
        <dd>{report.volumeCm3.toFixed(1)} cm³</dd>
        <dt className="text-foreground/50">Bordes abiertos</dt>
        <dd>{report.boundaryEdges}</dd>
        <dt className="text-foreground/50">Aristas no-manifold</dt>
        <dd>{report.nonManifoldEdges}</dd>
      </dl>

      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(report.fitsPrinter).map(([printer, fits]) => (
          <span
            key={printer}
            className={`rounded-full px-2 py-1 ${
              fits
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-foreground/10 text-foreground/50"
            }`}
          >
            {fits ? "✓" : "✕"} {printer}
          </span>
        ))}
      </div>

      {report.warnings.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">Problemas</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-400">
            {report.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {report.suggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">Cómo arreglarlo</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {report.suggestions.map((suggestion, i) => (
              <li key={i}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
