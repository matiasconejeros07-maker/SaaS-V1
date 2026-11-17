import { ArrowRight, Check, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, storeUrl } from "@/config/brand";
import { agoLabel, clp, greeting } from "@/lib/format";
import { getStoreContext } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";
import { FULFILLMENT_LABEL, STATUS_LABEL, type Order } from "@/lib/types";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Inicio" };

const dayKey = (d: Date, tz: string) => d.toLocaleDateString("en-CA", { timeZone: tz });
const statusClass: Record<string, string> = { new: "info", preparing: "warn", ready: "ok", completed: "", cancelled: "bad" };

export default async function Home({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const { bienvenida } = await searchParams;
  const { store, userName } = await getStoreContext();
  const supabase = await supabaseServer();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: ordersData }, { count: productCount }, { count: hoursCount }] = await Promise.all([
    supabase.from("orders").select("id, number, status, fulfillment, channel, customer_name, total, created_at")
      .eq("store_id", store.id).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("opening_hours").select("weekday", { count: "exact", head: true }).eq("store_id", store.id),
  ]);
  const orders = (ordersData ?? []) as Order[];
  const tz = store.timezone;
  const today = dayKey(new Date(), tz);
  const valid = orders.filter((o) => o.status !== "cancelled");
  const todays = valid.filter((o) => dayKey(new Date(o.created_at), tz) === today);
  const salesToday = todays.reduce((t, o) => t + o.total, 0);
  const avg30 = valid.length ? valid.reduce((t, o) => t + o.total, 0) / valid.length : 0;
  const active = orders.filter((o) => ["new", "preparing", "ready"].includes(o.status));
  const waiting = orders.filter((o) => o.status === "new").length;
  const url = storeUrl(store.slug);

  const tasks: [boolean, string, string][] = [
    [(productCount ?? 0) > 0, "Agrega tus productos", "/panel/productos"],
    [!!store.logo_url, "Sube tu logo", "/panel/configuracion"],
    [!!store.description, "Escribe la descripción de tu tienda", "/panel/configuracion"],
    [!!store.address || !store.pickup_enabled, "Agrega la dirección del local", "/panel/configuracion"],
    [(hoursCount ?? 0) > 0, "Define tu horario de atención", "/panel/configuracion"],
  ];
  const done = tasks.filter((t) => t[0]).length;

  return (
    <div className="page">
      {bienvenida && <div className="alert ok" role="status"><Check />Tu tienda está creada. Completa estos pasos y comparte tu enlace.</div>}
      <div className="page-h">
        <div>
          <h1>{greeting()}{userName ? `, ${userName}` : ""}</h1>
          <p>{active.length
            ? <>Tienes <b style={{ color: "var(--ink)" }}>{active.length} {active.length === 1 ? "pedido activo" : "pedidos activos"}</b>{waiting ? `; ${waiting} esperan confirmación.` : "."}</>
            : "No tienes pedidos pendientes."}</p>
        </div>
        <Link className="btn btn-primary" href="/panel/pedidos">Ver pedidos <ArrowRight /></Link>
      </div>

      <div className="kpis">
        <div className="card kpi"><span>Ventas de hoy</span><b>{clp(salesToday)}</b><small>{todays.length} {todays.length === 1 ? "pedido" : "pedidos"}</small></div>
        <div className="card kpi"><span>Pedidos activos</span><b>{active.length}</b><small>{waiting} por confirmar</small></div>
        <div className="card kpi"><span>Ticket promedio</span><b>{clp(avg30)}</b><small>Últimos 30 días</small></div>
        <div className="card kpi"><span>Pedidos en 30 días</span><b>{valid.length}</b><small>{clp(valid.reduce((t, o) => t + o.total, 0))} en ventas</small></div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="panel-h"><h3>Pedidos recientes</h3><Link className="btn btn-ghost btn-sm" href="/panel/pedidos">Tablero <ArrowRight /></Link></div>
          {orders.length ? (
            <div className="tscroll">
              <table className="table">
                <thead><tr><th>#</th><th>Cliente</th><th>Entrega</th><th>Estado</th><th className="r">Total</th></tr></thead>
                <tbody>
                  {orders.slice(0, 8).map((o) => (
                    <tr key={o.id}>
                      <td className="mono">{o.number}</td>
                      <td><b>{o.customer_name}</b><br /><span className="muted" style={{ fontSize: 12 }}>hace {agoLabel(o.created_at)}</span></td>
                      <td>{FULFILLMENT_LABEL[o.fulfillment]}</td>
                      <td><span className={`pill ${statusClass[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                      <td className="r mono">{clp(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              Aún no tienes pedidos. Abre tu tienda y haz un pedido de prueba.
              <a className="btn btn-primary btn-sm" href={`/${store.slug}`} target="_blank" rel="noopener">Abrir mi tienda</a>
            </div>
          )}
        </section>

        <div style={{ display: "grid", gap: 24 }}>
          {done < tasks.length && (
            <section className="card">
              <div className="panel-h"><h3>Deja tu tienda lista</h3><span className="mono muted" style={{ fontSize: 13 }}>{done}/{tasks.length}</span></div>
              <div style={{ padding: 16, display: "grid", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, fontSize: 13 }} className="muted">
                  <span className="progress"><i style={{ width: `${(done / tasks.length) * 100}%` }} /></span>{Math.round((done / tasks.length) * 100)}%
                </div>
                {tasks.map(([ok, t, href]) => (
                  <Link key={t} href={href} className={`task ${ok ? "ok" : ""}`}>
                    <span className="bx">{ok && <Check />}</span><span className="t">{t}</span>{!ok && <ChevronRight className="go" />}
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section className="card">
            <div className="panel-h"><h3>Tu enlace</h3></div>
            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              <CopyLink url={url} label={`${BRAND.domain}/${store.slug}`} />
              <p className="muted" style={{ fontSize: 13 }}>Ponlo en tu bio de Instagram, en tus estados de WhatsApp o imprímelo como QR para tu mesón.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
