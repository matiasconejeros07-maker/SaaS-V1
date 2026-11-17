import { Check } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clp } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";
import { AutoRefresh } from "./refresh";

export const metadata: Metadata = { title: "Estado de tu pedido", robots: { index: false } };

const STEPS: [OrderStatus, string][] = [["new", "Recibido"], ["preparing", "En preparación"], ["ready", "Listo"], ["completed", "Entregado"]];

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) notFound();
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("get_order_status", { p_token: token });
  const o = Array.isArray(data) ? data[0] : data;
  if (!o) notFound();
  const idx = STEPS.findIndex(([s]) => s === o.status);
  const cancelled = o.status === "cancelled";
  return (
    <main className="track">
      <span className="eyebrow">{o.store_name}</span>
      <h1>Pedido #{o.number}</h1>
      <p className="muted">{clp(o.total)} · {new Date(o.created_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" })}</p>
      {cancelled ? <div className="alert bad">El local anuló este pedido. Si tienes dudas, escríbele por WhatsApp.</div> : (
        <ol className="track-steps">
          {STEPS.map(([s, l], i) => (
            <li key={s} className={i < idx ? "done" : i === idx ? "cur" : ""}><span className="bx">{i <= idx && <Check />}</span>{l}</li>
          ))}
        </ol>
      )}
      {!cancelled && o.status !== "completed" && <AutoRefresh />}
    </main>
  );
}
