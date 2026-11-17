import { LogOut } from "lucide-react";
import Link from "next/link";
import { Thumb } from "@/components/thumb";
import { ToastProvider } from "@/components/ui";
import { BRAND, PLAN } from "@/config/brand";
import { clp } from "@/lib/format";
import { getStoreContext, trialDaysLeft } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";
import { Topbar } from "./command";
import { MobileNav, PanelNav } from "./nav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { store, subscription } = await getStoreContext();
  const supabase = await supabaseServer();
  const { count } = await supabase.from("orders").select("id", { count: "exact", head: true })
    .eq("store_id", store.id).in("status", ["new", "preparing", "ready"]);
  const days = trialDaysLeft(subscription);

  return (
    <ToastProvider>
      <div className="admin">
        <aside className="side">
          <div className="store-switch">
            <Thumb name={store.name} src={store.logo_url} className="avatar" />
            <div style={{ minWidth: 0 }}>
              <b>{store.name}</b>
              <span>{BRAND.domain}/{store.slug}</span>
            </div>
          </div>
          <PanelNav store={store} activeOrders={count ?? 0} />
          <div className="side-foot">
            {days !== null && (
              <Link href="/panel/plan" className="plan-box">
                <b>Prueba gratis · {days} {days === 1 ? "día" : "días"}</b>
                <span className="muted">Luego {clp(PLAN.priceClp)} al mes</span>
                <span className="bar"><i style={{ width: `${Math.max(4, ((PLAN.trialDays - days) / PLAN.trialDays) * 100)}%` }} /></span>
              </Link>
            )}
            <form action="/salir" method="post">
              <button className="nav-item" style={{ width: "100%", border: 0, background: "none", cursor: "pointer" }}><LogOut />Cerrar sesión</button>
            </form>
          </div>
        </aside>
        <div className="main">
          <MobileNav />
          <Topbar storeSlug={store.slug} storeName={store.name} />
          {children}
        </div>
      </div>
    </ToastProvider>
  );
}
