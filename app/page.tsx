import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

const MAKER_FEATURES = [
  {
    href: "/maker",
    icon: "💬",
    title: "Chat de diagnóstico",
    description:
      "Sube una foto de tu impresión y recibe ajustes exactos para Bambu Studio, más recomendación de filamento.",
  },
  {
    href: "/maker/diseno",
    icon: "🎨",
    title: "Diseño con IA",
    description: "Escribe una idea y genera un render de referencia para tus piezas decorativas.",
  },
  {
    href: "/maker/stl",
    icon: "📐",
    title: "Diagnóstico STL",
    description: "Sube un STL y detecta agujeros, geometría rota o si cabe en tu impresora antes de imprimir.",
  },
  {
    href: "/maker/imagen-a-3d",
    icon: "🖼️",
    title: "Imagen → 3D",
    description: "Convierte una foto en un modelo 3D real, previsualízalo girando y expórtalo a STL.",
  },
  {
    href: "/maker/filamentos",
    icon: "🧵",
    title: "Filamentos",
    description: "Compara PLA, PETG, ASA y TPU, con enlaces directos de compra en Amazon y AliExpress.",
  },
];

export default function Home() {
  return (
    <div className="maker-bg min-h-screen">
      <SiteNav />

      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-16 sm:py-24">
        <section className="flex flex-col items-center gap-6 text-center">
          <Image
            src="/logo-bruna.png"
            alt="Bruna by Libor"
            width={259}
            height={96}
            className="h-20 w-auto sm:h-24 dark:invert"
            priority
          />
          <span className="rounded-full border border-foreground/15 bg-background/60 px-3 py-1 text-xs font-medium text-foreground/60 backdrop-blur-sm">
            Impulsado por IA
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            De la idea a la pieza impresa,{" "}
            <span className="text-amber-600 dark:text-amber-400">con ayuda de IA</span>
          </h1>
          <p className="max-w-xl text-foreground/60">
            Diagnóstico de impresión, diseño de renders, generación de modelos 3D y todo lo que necesitas para el
            taller Bambu Lab de Bruna — en un solo lugar.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/maker"
              className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Entrar a Maker 3D
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MAKER_FEATURES.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="group flex flex-col gap-2 rounded-xl border border-foreground/15 bg-background/70 p-5 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
            >
              <span className="text-2xl" aria-hidden="true">
                {feature.icon}
              </span>
              <h2 className="font-medium">{feature.title}</h2>
              <p className="text-sm text-foreground/60">{feature.description}</p>
              <span className="mt-auto pt-1 text-sm font-medium text-amber-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-amber-400">
                Abrir →
              </span>
            </Link>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
