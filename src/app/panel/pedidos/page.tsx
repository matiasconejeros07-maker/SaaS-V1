import type { Metadata } from "next";
import { getStoreContext } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { OrdersBoard } from "./board";

export const metadata: Metadata = { title: "Pedidos" };

export default async function Page() {
  const { store } = await getStoreContext();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("orders").select("*, order_items(*), tables(label)")
    .eq("store_id", store.id).in("status", ["new", "preparing", "ready"])
    .order("created_at", { ascending: true }).limit(200);
  return (
    <div className="page">
      <div className="page-h">
        <div><h1>Pedidos</h1><p>Los pedidos nuevos aparecen solos. No necesitas recargar la página.</p></div>
      </div>
      <OrdersBoard storeId={store.id} initial={(data ?? []) as Order[]} />
    </div>
  );
}
