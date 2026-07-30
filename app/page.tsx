import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Panel de agentes</h1>
        <p className="text-sm text-foreground/60">
          Dos áreas independientes: maker 3D / Amazon y consultoría contable por cliente.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/maker"
          className="flex flex-col gap-2 rounded-xl border border-foreground/15 p-5 transition-colors hover:bg-foreground/5"
        >
          <span className="text-lg font-medium">Maker 3D</span>
          <span className="text-sm text-foreground/60">
            Diseño, modelado en línea (imagen o idea → STL), calibraciones Bambu Lab,
            filamentos, impresión y listados Amazon.
          </span>
        </Link>

        <Link
          href="/consultoria"
          className="flex flex-col gap-2 rounded-xl border border-foreground/15 p-5 transition-colors hover:bg-foreground/5"
        >
          <span className="text-lg font-medium">Consultoría contable</span>
          <span className="text-sm text-foreground/60">
            Clientes de contabilidad y cuentas por pagar. Baltimore y futuros clientes,
            cada uno con su agente y bandeja.
          </span>
        </Link>
      </div>
    </main>
  );
}
