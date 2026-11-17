"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ORDER_SELECT, type Order, type OrderStatus } from "@/lib/types";


/**
 * Pedidos de la tienda en vivo (Supabase Realtime) con respaldo por consulta
 * cada 10 s si el canal no conecta. Llama onNew(order) cuando entra un pedido.
 */
export function useLiveOrders(storeId: string, statuses: OrderStatus[], initial: Order[], onNew?: (o: Order) => void) {
  const supabase = supabaseBrowser();
  const [orders, setOrders] = useState<Order[]>(initial);
  const [live, setLive] = useState<"connecting" | "on" | "off">("connecting");
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;
  const key = statuses.join(",");

  const refetch = useCallback(async () => {
    const { data } = await supabase.from("orders").select(ORDER_SELECT).eq("store_id", storeId)
      .in("status", key.split(",")).order("created_at", { ascending: true }).limit(200);
    if (!data) return;
    setOrders((prev) => {
      const known = new Set(prev.map((o) => o.id));
      (data as Order[]).filter((o) => !known.has(o.id)).forEach((o) => onNewRef.current?.(o));
      return data as Order[];
    });
  }, [supabase, storeId, key]);

  useEffect(() => {
    const ch = supabase.channel(`live-${storeId}-${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` }, () => refetch())
      .subscribe((s: string) => setLive(s === "SUBSCRIBED" ? "on" : s === "CLOSED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT" ? "off" : "connecting"));
    return () => { supabase.removeChannel(ch); };
  }, [supabase, storeId, key, refetch]);

  useEffect(() => {
    if (live === "on") return;
    const t = setInterval(refetch, 10000);
    return () => clearInterval(t);
  }, [live, refetch]);

  return { orders, setOrders, live, refetch };
}

/** Pitido corto. Requiere que el usuario haya interactuado (política de audio del navegador). */
export function beep(ctx: AudioContext | null) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.frequency.value = 880; g.gain.setValueAtTime(0.18, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  o.start(); o.stop(ctx.currentTime + 0.6);
}
