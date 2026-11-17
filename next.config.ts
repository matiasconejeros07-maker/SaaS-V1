import type { NextConfig } from "next";

/**
 * SUPABASE_PROXY_TARGET (opcional, solo desarrollo): reenvía /sb/* al Supabase local,
 * para que un navegador que no ve 127.0.0.1:54321 (vista previa remota) pueda usar la app.
 */
const proxyTarget = process.env.SUPABASE_PROXY_TARGET;

const nextConfig: NextConfig = {
  async rewrites() {
    return proxyTarget ? [{ source: "/sb/:path*", destination: `${proxyTarget}/:path*` }] : [];
  },
};

export default nextConfig;
