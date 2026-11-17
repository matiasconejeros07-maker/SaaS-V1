import type { Metadata } from "next";
import { getStoreContext } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";
import type { CashSession, Category, DiningTable, PaymentMethod, Product } from "@/lib/types";
import { ModuleGate } from "../module-gate";
import { Pos } from "./pos";

export const metadata: Metadata = { title: "Caja" };

export default async function Page({ searchParams }: { searchParams: Promise<{ mesa?: string }> }) {
  const { mesa } = await searchParams;
  const { store, role } = await getStoreContext();
  const supabase = await supabaseServer();
  // La caja también sirve para tomar comandas de mesa aunque el módulo POS esté apagado.
  const enabled = store.modules?.pos || store.modules?.tables;
  const [{ data: products }, { data: categories }, { data: tables }, { data: session }] = await Promise.all([
    supabase.from("products").select("*").eq("store_id", store.id).order("position").order("name"),
    supabase.from("categories").select("*").eq("store_id", store.id).order("position").order("name"),
    supabase.from("tables").select("*").eq("store_id", store.id),
    supabase.from("cash_sessions").select("*").eq("store_id", store.id).is("closed_at", null).maybeSingle(),
  ]);
  const { data: summary } = session
    ? await supabase.rpc("cash_session_summary", { p_session: session.id })
    : { data: [] };
  const sortedTables = ((tables ?? []) as DiningTable[]).sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));
  return (
    <div className="page">
      <ModuleGate store={enabled ? { ...store, modules: { ...store.modules, pos: true } } : store} module="pos" canEdit={role !== "staff"}>
        <Pos storeId={store.id} products={(products ?? []) as Product[]} categories={(categories ?? []) as Category[]}
          tables={store.modules?.tables ? sortedTables : []} session={session as CashSession | null}
          summary={(summary ?? []) as { payment_method: PaymentMethod; orders: number; total: number }[]}
          kitchenOn={!!store.modules?.kitchen} initialTable={mesa ?? null} />
      </ModuleGate>
    </div>
  );
}
