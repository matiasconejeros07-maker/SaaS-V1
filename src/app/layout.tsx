import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { BRAND } from "@/config/brand";
import "./globals.css";
import "./polish.css";

const ui = Plus_Jakarta_Sans({ variable: "--font-ui", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · Tienda online y pedidos para pymes`, template: `%s · ${BRAND.name}` },
  description: "Catálogo online, carta QR y gestión de pedidos para pymes chilenas. 0% de comisión por venta.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e0c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL">
      <body className={`${ui.variable} ${code.variable}`}>{children}</body>
    </html>
  );
}
