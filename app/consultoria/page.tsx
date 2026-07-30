import Link from "next/link";

const CLIENTS = [
  {
    slug: "baltimore",
    name: "Baltimore",
    description: "Cuentas por pagar, soporte contable y triaje de correo Gmail.",
  },
] as const;

export default function ConsultoriaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Consultoría contable</h1>
          <Link href="/" className="shrink-0 text-sm underline text-foreground/70">
            ← Inicio
          </Link>
        </div>
        <p className="text-sm text-foreground/60">
          Selecciona un cliente. Cada uno tiene chat, base de conocimiento y herramientas
          propias.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {CLIENTS.map((client) => (
          <li key={client.slug}>
            <Link
              href={`/consultoria/${client.slug}`}
              className="flex flex-col gap-1 rounded-xl border border-foreground/15 p-4 transition-colors hover:bg-foreground/5"
            >
              <span className="font-medium">{client.name}</span>
              <span className="text-sm text-foreground/60">{client.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
