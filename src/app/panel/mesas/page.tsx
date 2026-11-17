import type { Metadata } from "next";
import { getStoreContext } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";
import type { DiningTable, Order } from "@/lib/types";
import { ModuleGate } from "../module-gate";
import { TablesManager } from "./tables";

export const metadata: Metadata = { title: "Mesas" };

export default async function Page() {
  const { store, role } = await getStoreContext();
  const supabase = await supabaseServer();
  const [{ data: tables }, { data: orders }, { data: cash }] = await Promise.all([
    supabase.from("tables").select("*").eq("store_id", store.id).order("created_at"),
    // Pedidos de mesa abiertos: en curso o aún sin pagar.
    supabase.from("orders").select("*, order_items(*)").eq("store_id", store.id).not("table_id", "is", null)
      .neq("status", "cancelled").or("payment_status.eq.pending,status.in.(new,preparing,ready)").order("created_at"),
    supabase.from("cash_sessions").select("id").eq("store_id", store.id).is("closed_at", null).maybeSingle(),
  ]);
  const sorted = ((tables ?? []) as DiningTable[]).sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));
  return (
    <div className="page">
      <ModuleGate store={store} module="tables" canEdit={role !== "staff"}>
        <TablesManager storeId={store.id} slug={store.slug} tables={sorted} orders={(orders ?? []) as Order[]}
          hasOpenCash={!!cash} canEdit={role !== "staff"} />
      </ModuleGate>
    </div>
  );
}
