import type { Metadata } from "next";
import { getStoreContext } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";
import { ORDER_SELECT, type Order } from "@/lib/types";
import { ModuleGate } from "../panel/module-gate";
import { Kitchen } from "./kitchen";

export const metadata: Metadata = { title: "Cocina" };

export default async function Page() {
  const { store, role } = await getStoreContext();
  if (!store.modules?.kitchen) {
    return <div className="page" style={{ margin: "0 auto" }}><ModuleGate store={store} module="kitchen" canEdit={role !== "staff"}>{null}</ModuleGate></div>;
  }
  const supabase = await supabaseServer();
  const { data } = await supabase.from("orders").select(ORDER_SELECT).eq("store_id", store.id)
    .in("status", ["new", "preparing", "ready"]).order("created_at").limit(200);
  return <Kitchen storeId={store.id} storeName={store.name} initial={(data ?? []) as Order[]} />;
}
