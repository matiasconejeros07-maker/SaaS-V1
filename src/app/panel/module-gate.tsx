"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Store } from "@/lib/types";

const INFO: Record<keyof Store["modules"], [string, string]> = {
  tables: ["Mesas y QR", "Crea tus mesas e imprime un QR para cada una. Tus clientes ven la carta y piden desde el celular; el pedido llega con el número de mesa."],
  kitchen: ["Pantalla de cocina", "Una pantalla para la cocina con las comandas en orden, el tiempo de cada una y un botón para marcarlas listas."],
  pos: ["Caja POS", "Cobra en el mesón con el mismo catálogo: efectivo con vuelto, tarjeta o transferencia. Apertura y cierre de caja con cuadratura."],
  inventory: ["Inventario", "Stock por producto y alertas de reposición."],
};

/** Si el módulo está apagado, muestra qué hace y un botón para activarlo. */
export function ModuleGate({ store, module, canEdit, children }: {
  store: Store; module: keyof Store["modules"]; canEdit: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (store.modules?.[module]) return <>{children}</>;
  const [title, text] = INFO[module];
  async function enable() {
    setBusy(true); setError(null);
    const { error } = await supabaseBrowser().from("stores").update({ modules: { ...store.modules, [module]: true } }).eq("id", store.id);
    setBusy(false);
    if (error) { setError("No se pudo activar. Intenta de nuevo."); return; }
    router.refresh();
  }
  return (
    <section className="card" style={{ padding: 36, display: "grid", gap: 14, maxWidth: 620 }}>
      <span className="eyebrow">Módulo inactivo</span>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>{title}</h1>
      <p className="muted">{text}</p>
      {error && <div className="alert bad">{error}</div>}
      {canEdit
        ? <button className="btn btn-primary" style={{ justifySelf: "start" }} disabled={busy} onClick={enable}>{busy ? "Activando…" : `Activar ${title.toLowerCase()}`}</button>
        : <p className="hint">Pide a la dueña o a un administrador que active este módulo.</p>}
      <p className="hint">Incluido en tu plan, sin costo extra.</p>
    </section>
  );
}
