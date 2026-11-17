"use client";
import { Bell, BellOff, Bike, MapPin, MessageCircle, QrCode, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer, useToast } from "@/components/ui";
import { agoLabel, clp, formatCLPhone, minutesAgo, qty } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { FULFILLMENT_LABEL, PAYMENT_LABEL, STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";

const COLS: { status: OrderStatus; title: string; color: string; action: string; next: OrderStatus; lateAfter: number }[] = [
  { status: "new", title: "Nuevos", color: "var(--info)", action: "Confirmar", next: "preparing", lateAfter: 5 },
  { status: "preparing", title: "Preparando", color: "var(--warn)", action: "Marcar listo", next: "ready", lateAfter: 25 },
  { status: "ready", title: "Listos para entregar", color: "var(--ok)", action: "Entregado", next: "completed", lateAfter: 30 },
];
const SELECT = "*, order_items(*), tables(label)";
type Filter = "all" | "web" | "table" | "pos";

export function OrdersBoard({ storeId, initial }: { storeId: string; initial: Order[] }) {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [sound, setSound] = useState(false);
  const [live, setLive] = useState<"connecting" | "on" | "off">("connecting");
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);

  const beep = useCallback(() => {
    const ctx = audio.current;
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
  }, []);

  const upsert = useCallback(async (id: string, isNew: boolean) => {
    const { data } = await supabase.from("orders").select(SELECT).eq("id", id).single();
    if (!data) return;
    setOrders((list) => {
      const rest = list.filter((o) => o.id !== id);
      return ["new", "preparing", "ready"].includes(data.status) ? [data as Order, ...rest] : rest;
    });
    if (isNew) {
      toast(`Nuevo pedido #${data.number} · ${clp(data.total)}`);
      if (sound) beep();
    }
  }, [supabase, toast, sound, beep]);

  useEffect(() => {
    const ch = supabase
      .channel(`orders-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (p: { eventType: string; new: { id?: string } }) => { if (p.new?.id) upsert(p.new.id, p.eventType === "INSERT"); })
      .subscribe((s: string) => setLive(s === "SUBSCRIBED" ? "on" : s === "CLOSED" || s === "CHANNEL_ERROR" ? "off" : "connecting"));
    return () => { supabase.removeChannel(ch); };
  }, [supabase, storeId, upsert]);

  // Respaldo: si el tiempo real no conecta (red con proxy), consulta cada 10 s.
  useEffect(() => {
    if (live === "on") return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("orders").select(SELECT).eq("store_id", storeId)
        .in("status", ["new", "preparing", "ready"]).order("created_at", { ascending: true }).limit(200);
      if (!data) return;
      setOrders((prev) => {
        const known = new Set(prev.map((o) => o.id));
        const fresh = (data as Order[]).filter((o) => !known.has(o.id));
        if (fresh.length) { toast(`Nuevo pedido #${fresh[0].number} · ${clp(fresh[0].total)}`); if (sound) beep(); }
        return data as Order[];
      });
    }, 10000);
    return () => clearInterval(t);
  }, [live, supabase, storeId, toast, sound, beep]);

  // Refresca los contadores de tiempo cada 30 s.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  async function advance(o: Order, to: OrderStatus) {
    const prev = orders;
    setOrders((l) => (["completed", "cancelled"].includes(to) ? l.filter((x) => x.id !== o.id) : l.map((x) => (x.id === o.id ? { ...x, status: to } : x))));
    const { error } = await supabase.from("orders").update({ status: to }).eq("id", o.id);
    if (error) { setOrders(prev); toast("No se pudo actualizar. Revisa tu conexión."); return; }
    toast(`Pedido #${o.number}: ${STATUS_LABEL[to].toLowerCase()}`);
    if (openId === o.id && ["completed", "cancelled"].includes(to)) setOpenId(null);
  }

  const shown = useMemo(() => orders.filter((o) => filter === "all" || o.channel === filter), [orders, filter]);
  const open = orders.find((o) => o.id === openId) ?? null;

  return (
    <>
      <div className="k-toolbar">
        <div className="seg" role="group" aria-label="Canal">
          {([["all", "Todos"], ["web", "Tienda online"], ["table", "Mesas"], ["pos", "Caja"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <span className="sp" />
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={sound}
          onClick={() => { audio.current ??= new AudioContext(); setSound(!sound); if (!sound) setTimeout(beep, 50); }}>
          {sound ? <Bell /> : <BellOff />}{sound ? "Sonido activado" : "Activar sonido"}
        </button>
        <span className="live" data-state={live}>
          <span className="dot" />{live === "on" ? "En vivo" : "Actualizando cada 10 s"}
        </span>
      </div>

      <div className="kanban">
        {COLS.map((c) => {
          const list = shown.filter((o) => o.status === c.status).sort((a, b) => a.created_at.localeCompare(b.created_at));
          return (
            <section className="k-col" key={c.status} aria-label={c.title}>
              <h2><span className="dot" style={{ color: c.color }} />{c.title}<span className="c">{list.length}</span></h2>
              {list.length === 0 && <div className="empty" style={{ padding: 20 }}>Sin pedidos aquí</div>}
              {list.map((o) => {
                const mins = minutesAgo(o.created_at, now);
                const late = mins > c.lateAfter;
                const Icon = o.fulfillment === "delivery" ? Bike : o.fulfillment === "dine_in" ? QrCode : ShoppingBag;
                return (
                  <article key={o.id} className={`ticket ${late ? "late" : ""}`} tabIndex={0}
                    onClick={() => { setOpenId(o.id); setConfirmCancel(false); }}
                    onKeyDown={(e) => e.key === "Enter" && setOpenId(o.id)}>
                    <div className="ticket-top">
                      <b>#{o.number}</b>
                      <span className="pill"><Icon />{o.tables?.label ?? FULFILLMENT_LABEL[o.fulfillment]}</span>
                      <span className="age">{late ? "Atrasado · " : ""}{agoLabel(o.created_at, now)}</span>
                    </div>
                    <div className="who">{o.tables?.label && o.tables.label !== o.customer_name ? `${o.tables.label} · ` : ""}{o.customer_name}</div>
                    <ul>{o.order_items?.map((i) => <li key={i.id}>{qty(i.quantity, i.unit)} {i.name}</li>)}</ul>
                    {o.note && <p className="note">“{o.note}”</p>}
                    <div className="ticket-foot">
                      <span className="tot">{clp(o.total)}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{PAYMENT_LABEL[o.payment_method]}</span>
                      <button type="button" className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); advance(o, c.next); }}>{c.action}</button>
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>

      <Drawer open={!!open} title={open ? `Pedido #${open.number}` : ""} onClose={() => setOpenId(null)}
        footer={open && (confirmCancel ? (
          <>
            <span className="muted" style={{ marginRight: "auto", fontSize: 13 }}>¿Anular este pedido?</span>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirmCancel(false)}>No</button>
            <button className="btn btn-danger" type="button" onClick={() => advance(open, "cancelled")}>Sí, anular</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" type="button" style={{ marginRight: "auto" }} onClick={() => setConfirmCancel(true)}>Anular</button>
            {COLS.filter((c) => c.status === open.status).map((c) => (
              <button key={c.status} className="btn btn-primary" type="button" onClick={() => advance(open, c.next)}>{c.action}</button>
            ))}
          </>
        ))}>
        {open && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pill">{STATUS_LABEL[open.status]}</span>
              <span className="pill">{FULFILLMENT_LABEL[open.fulfillment]}</span>
              <span className="pill">hace {agoLabel(open.created_at, now)}</span>
            </div>
            <dl className="kv">
              <dt>Cliente</dt><dd>{open.customer_name}</dd>
              {open.customer_phone && (<><dt>Teléfono</dt><dd>
                <a href={`https://wa.me/${open.customer_phone}`} target="_blank" rel="noopener">{formatCLPhone(open.customer_phone)}</a>
              </dd></>)}
              {open.address && (<><dt>Dirección</dt><dd>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(open.address)}`} target="_blank" rel="noopener">{open.address}</a>
              </dd></>)}
              <dt>Pago</dt><dd>{PAYMENT_LABEL[open.payment_method]} · {open.payment_status === "paid" ? "Pagado" : "Por cobrar"}</dd>
              {open.note && (<><dt>Nota</dt><dd>{open.note}</dd></>)}
            </dl>
            <div className="sum">
              {open.order_items?.map((i) => (
                <div key={i.id}><span>{qty(i.quantity, i.unit)} {i.name}</span><span className="mono">{clp(i.line_total)}</span></div>
              ))}
              {open.delivery_fee > 0 && <div><span className="muted">Delivery</span><span className="mono">{clp(open.delivery_fee)}</span></div>}
              <div className="t"><span>Total</span><span className="mono">{clp(open.total)}</span></div>
            </div>
            {open.customer_phone && (
              <a className="btn btn-ghost" href={`https://wa.me/${open.customer_phone}?text=${encodeURIComponent(`Hola ${open.customer_name}, recibimos tu pedido #${open.number}.`)}`} target="_blank" rel="noopener">
                <MessageCircle />Escribir al cliente
              </a>
            )}
            {open.address && (
              <a className="btn btn-soft" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(open.address)}`} target="_blank" rel="noopener"><MapPin />Abrir en Google Maps</a>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
