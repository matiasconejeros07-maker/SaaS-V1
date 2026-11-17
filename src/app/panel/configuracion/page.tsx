import type { Metadata } from "next";
import { getStoreContext } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";
import type { OpeningHour } from "@/lib/types";
import { Settings } from "./settings";

export const metadata: Metadata = { title: "Configuración" };

export default async function Page() {
  const { store, role } = await getStoreContext();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("opening_hours").select("*").eq("store_id", store.id);
  return (
    <div className="page">
      <div className="page-h"><div><h1>Configuración</h1><p>Datos de tu tienda, entrega, pagos y horario.</p></div></div>
      {role === "staff"
        ? <div className="alert warn">Solo la dueña o un administrador pueden cambiar la configuración.</div>
        : <Settings store={store} hours={(data ?? []) as OpeningHour[]} />}
    </div>
  );
}
