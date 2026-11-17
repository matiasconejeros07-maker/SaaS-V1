import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { ToastProvider } from "@/components/ui";
import { BRAND, PLAN } from "@/config/brand";
import { clp } from "@/lib/format";
import { getStoreContext, trialDaysLeft } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";
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
            <div className="avatar">{store.logo_url ? <img src={store.logo_url} alt="" /> : store.name[0]?.toUpperCase()}</div>
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
          <div className="topbar">
            <span className="sp" />
            <a className="btn btn-ghost btn-sm" href={`/${store.slug}`} target="_blank" rel="noopener"><ExternalLink />Ver mi tienda</a>
          </div>
          {children}
        </div>
      </div>
    </ToastProvider>
  );
}
