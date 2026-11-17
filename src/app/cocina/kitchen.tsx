"use client";
import { ArrowLeft, Bell, BellOff, Bike, Maximize, QrCode, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { minutesAgo, qty } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { beep, useLiveOrders } from "@/lib/use-live-orders";
import { FULFILLMENT_LABEL, type Fulfillment, type Order, type OrderStatus } from "@/lib/types";

type Filter = "all" | Fulfillment;
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { new: "preparing", preparing: "ready", ready: "completed" };

export function Kitchen({ storeId, storeName, initial }: { storeId: string; storeName: string; initial: Order[] }) {
  const supabase = supabaseBrowser();
  const audio = useRef<AudioContext | null>(null);
  const [sound, setSound] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const { orders, setOrders, live } = useLiveOrders(storeId, ["new", "preparing", "ready"], initial, (o) => {
    setFlash(o.id);
    setTimeout(() => setFlash(null), 4000);
    if (soundRef.current) beep(audio.current);
  });

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);

  async function move(o: Order) {
    const to = NEXT[o.status];
    if (!to) return;
    setError(null);
    setOrders((l) => (to === "completed" ? l.filter((x) => x.id !== o.id) : l.map((x) => (x.id === o.id ? { ...x, status: to } : x))));
    const { error } = await supabase.from("orders").update({ status: to }).eq("id", o.id);
    if (error) { setError("No se pudo actualizar la comanda. Revisa la conexión."); setOrders((l) => l.some((x) => x.id === o.id) ? l.map((x) => (x.id === o.id ? o : x)) : [...l, o]); }
  }

  const shown = useMemo(() => orders.filter((o) => filter === "all" || o.fulfillment === filter), [orders, filter]);
  const col = (s: OrderStatus) => shown.filter((o) => o.status === s).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const clock = new Date(now).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

  const ticket = (o: Order) => {
    const mins = minutesAgo(o.created_at, now);
    const tone = mins >= 20 ? "bad" : mins >= 10 ? "warn" : "ok";
    const Icon = o.fulfillment === "delivery" ? Bike : o.fulfillment === "dine_in" ? QrCode : ShoppingBag;
    const where = o.tables?.label ?? FULFILLMENT_LABEL[o.fulfillment];
    return (
      <article key={o.id} className={`kds-ticket ${flash === o.id ? "flash" : ""}`} data-tone={tone}>
        <header>
          <span className="kds-where"><Icon />{where}</span>
          <span className="kds-time num" suppressHydrationWarning>{mins} min</span>
        </header>
        <div className="kds-sub">#{o.number}{o.customer_name && o.customer_name !== o.tables?.label ? ` · ${o.customer_name}` : ""}</div>
        <ul>
          {o.order_items?.map((i) => <li key={i.id}><b>{qty(i.quantity, i.unit)}</b> {i.name}</li>)}
        </ul>
        {o.note && <p className="kds-note">{o.note}</p>}
        <button type="button" className={`kds-btn ${o.status}`} onClick={() => move(o)}>
          {o.status === "new" ? "Empezar" : o.status === "preparing" ? "Listo" : o.fulfillment === "dine_in" ? "Servido" : "Entregado"}
        </button>
      </article>
    );
  };

  return (
    <div className="kds">
      <header className="kds-bar">
        <Link href="/panel" className="kds-icon" aria-label="Volver al panel"><ArrowLeft /></Link>
        <div className="kds-title"><b>Cocina</b><span>{storeName}</span></div>
        <div className="kds-filters" role="group" aria-label="Tipo de pedido">
          {([["all", "Todos"], ["dine_in", "Mesa"], ["pickup", "Retiro"], ["delivery", "Delivery"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <span className="kds-live" data-state={live}><span className="dot" />{live === "on" ? "En vivo" : "Cada 10 s"}</span>
        <button type="button" className="kds-icon" aria-pressed={sound} aria-label={sound ? "Silenciar avisos" : "Activar sonido"}
          onClick={() => { audio.current ??= new AudioContext(); if (!sound) beep(audio.current); setSound(!sound); }}>
          {sound ? <Bell /> : <BellOff />}
        </button>
        <button type="button" className="kds-icon" aria-label="Pantalla completa"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}>
          <Maximize />
        </button>
        <span className="kds-clock num" suppressHydrationWarning>{clock}</span>
      </header>
      {error && <div className="kds-error" role="alert">{error}</div>}
      <main className="kds-cols">
        {([["new", "Por preparar"], ["preparing", "En preparación"], ["ready", "Listos"]] as [OrderStatus, string][]).map(([s, title]) => {
          const list = col(s);
          return (
            <section key={s} className={`kds-col ${s}`} aria-label={title}>
              <h2>{title}<span className="num">{list.length}</span></h2>
              <div className="kds-list">
                {list.length ? list.map(ticket) : <p className="kds-empty">{s === "new" ? "Sin comandas nuevas" : "Nada aquí"}</p>}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
