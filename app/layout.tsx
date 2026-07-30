import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panel de agentes",
  description: "Maker 3D y consultoría contable con agentes de IA",
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
