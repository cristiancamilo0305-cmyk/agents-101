"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/maker", label: "Chat" },
  { href: "/maker/diseno", label: "Diseño" },
  { href: "/maker/stl", label: "STL" },
  { href: "/maker/imagen-a-3d", label: "Imagen → 3D" },
  { href: "/maker/filamentos", label: "Filamentos" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        <Link href="/" className="flex shrink-0 items-center rounded-md">
          <Image
            src="/logo-bruna.png"
            alt="Bruna by Libor"
            width={108}
            height={40}
            className="h-9 w-auto dark:invert"
            priority
          />
        </Link>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-foreground/10 font-medium text-foreground"
                    : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
