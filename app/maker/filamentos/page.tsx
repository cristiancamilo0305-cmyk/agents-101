import { FILAMENT_PROFILES } from "@/lib/tools/filament-data";
import { buildShoppingLinks } from "@/lib/tools/filament-shopping";

export default function FilamentShopPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Filamentos</h1>
      <p className="text-sm text-foreground/60">
        Enlaces de búsqueda a Amazon y AliExpress por tipo de filamento. Son resultados en vivo, no un catálogo
        curado — compara precio, marca y reseñas antes de comprar.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {FILAMENT_PROFILES.map((profile) => {
          const links = buildShoppingLinks(`${profile.material} 3D printing filament 1.75mm`);
          return (
            <div
              key={profile.material}
              className="flex flex-col gap-2 rounded-xl border border-foreground/15 bg-background/70 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
            >
              <h2 className="font-medium">{profile.material}</h2>
              <p className="text-xs text-foreground/60">{profile.notas}</p>
              <div className="mt-1 flex gap-2 text-sm">
                <a
                  href={links.amazon}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-foreground px-3 py-1.5 text-background"
                >
                  Amazon
                </a>
                <a
                  href={links.aliexpress}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-foreground/20 px-3 py-1.5"
                >
                  AliExpress
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
