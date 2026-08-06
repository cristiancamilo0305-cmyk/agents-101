import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bruna by Libor — Maker 3D",
  description: "Diseño, diagnóstico e impresión 3D con IA para la marca Bruna by Libor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
