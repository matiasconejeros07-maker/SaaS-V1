"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Actualiza el estado cada 20 segundos mientras el pedido está en curso. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => { const t = setInterval(() => router.refresh(), 20000); return () => clearInterval(t); }, [router]);
  return <p className="muted" style={{ fontSize: 13 }}>Esta página se actualiza sola.</p>;
}
