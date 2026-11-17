import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { qrSvg, tableUrl } from "@/lib/qr";
import { getStoreContext } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";
import type { DiningTable } from "@/lib/types";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Imprimir QR de mesas" };

export default async function Page() {
  const { store } = await getStoreContext();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("tables").select("*").eq("store_id", store.id);
  const tables = ((data ?? []) as DiningTable[]).sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));
  const cards = await Promise.all(tables.map(async (t) => ({ t, svg: await qrSvg(tableUrl(store.slug, t.token)) })));
  return (
    <div className="print-sheet">
      <div className="print-bar">
        <p><b>{tables.length} tarjetas</b> · Recórtalas y pégalas en cada mesa. Usa papel tamaño carta y escala 100 %.</p>
        <PrintButton />
      </div>
      <div className="print-grid">
        {cards.map(({ t, svg }) => (
          <div className="print-card" key={t.id}>
            <span className="pc-store">{store.name}</span>
            <div className="pc-qr" dangerouslySetInnerHTML={{ __html: svg }} />
            <b className="pc-table">{t.label}</b>
            <span className="pc-help">Escanea para ver la carta y pedir</span>
            <span className="pc-brand">{BRAND.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
