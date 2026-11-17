"use client";
import { ChefHat, Lock, Minus, Plus, ScanBarcode, Search, Trash2, Unlock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Thumb } from "@/components/thumb";
import { Drawer, Field, useToast } from "@/components/ui";
import { clp, qty } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PAYMENT_LABEL, type CashSession, type Category, type DiningTable, type PaymentMethod, type Product } from "@/lib/types";
import { PaymentPicker } from "./payment";

type Line = { p: Product; q: number };
type Summary = { payment_method: PaymentMethod; orders: number; total: number }[];

export function Pos({ storeId, products, categories, tables, session, summary, kitchenOn, initialTable }: {
  storeId: string; products: Product[]; categories: Category[]; tables: DiningTable[];
  session: CashSession | null; summary: Summary; kitchenOn: boolean; initialTable: string | null;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const search = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [tableId, setTableId] = useState<string>(initialTable && tables.some((t) => t.id === initialTable) ? initialTable : "");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [sheet, setSheet] = useState<"pay" | "open" | "close" | "weight" | null>(null);
  const [pay, setPay] = useState<{ method: PaymentMethod; received: number | null }>({ method: "cash", received: null });
  const [alsoKitchen, setAlsoKitchen] = useState(kitchenOn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState("");
  const [counted, setCounted] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [weighing, setWeighing] = useState<{ p: Product; kg: string } | null>(null);

  const total = lines.reduce((t, l) => t + Math.round(l.p.price * l.q), 0);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => (cat === "all" || p.category_id === cat) && (!term || p.name.toLowerCase().includes(term) || p.barcode === q.trim()));
  }, [products, q, cat]);
  const cashTotal = summary.find((s) => s.payment_method === "cash")?.total ?? 0;
  const expected = (session?.opening_amount ?? 0) + cashTotal;

  function add(p: Product, amount?: number) {
    if (!p.is_available) { toast(`${p.name} está agotado`); return; }
    if (p.unit === "kg" && amount === undefined) { setWeighing({ p, kg: "" }); setSheet("weight"); return; }
    const d = amount ?? 1;
    setLines((ls) => {
      const i = ls.findIndex((l) => l.p.id === p.id);
      if (i < 0) return [...ls, { p, q: d }];
      return ls.map((l, j) => (j === i ? { ...l, q: Math.round((l.q + d) * 1000) / 1000 } : l));
    });
  }
  const setQty = (id: string, qn: number) => setLines((ls) => ls.flatMap((l) => (l.p.id !== id ? [l] : qn > 0 ? [{ ...l, q: qn }] : [])));

  // Lector de código de barras: escribe el código y envía Enter.
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = q.trim();
    const hit = products.find((p) => p.barcode && p.barcode === code) ?? (list.length === 1 ? list[0] : undefined);
    if (hit) { add(hit); setQ(""); } else if (code) toast(`No hay productos con "${code}"`);
  }

  function reset() { setLines([]); setName(""); setNote(""); setPay({ method: "cash", received: null }); setError(null); search.current?.focus(); }

  async function sell(paid: boolean) {
    if (!lines.length) return;
    if (paid && pay.method === "cash" && pay.received !== null && pay.received < total) { setError("El efectivo recibido es menor que el total."); return; }
    setBusy(true); setError(null);
    const sendKitchen = !paid || (kitchenOn && alsoKitchen);
    const { data, error } = await supabase.rpc("pos_sale", {
      p_store: storeId,
      p_items: lines.map((l) => ({ product_id: l.p.id, quantity: l.q })),
      p_payment_method: paid ? pay.method : "cash",
      p_paid: paid,
      p_send_to_kitchen: sendKitchen,
      p_table_id: tableId || null,
      p_customer_name: name.trim() || null,
      p_note: note.trim() || null,
      p_cash_received: paid && pay.method === "cash" ? pay.received : null,
    });
    setBusy(false);
    if (error) { setError(error.message); if (!paid) toast(error.message); return; }
    const r = Array.isArray(data) ? data[0] : data;
    setSheet(null);
    toast(paid
      ? (r.change > 0 ? `Venta #${r.order_number} · vuelto ${clp(r.change)}` : `Venta #${r.order_number} cobrada`)
      : kitchenOn ? `Comanda #${r.order_number} enviada a cocina` : `Pedido #${r.order_number} anotado en ${table?.label ?? "la mesa"}`);
    reset();
    if (!paid && tableId) router.push("/panel/mesas"); else router.refresh();
  }

  async function openCash() {
    setBusy(true); setError(null);
    const { error } = await supabase.rpc("open_cash_session", { p_store: storeId, p_opening_amount: Number(opening) || 0 });
    setBusy(false);
    if (error) { setError(error.message); return; }
    toast("Caja abierta"); setSheet(null); setOpening(""); router.refresh();
  }

  async function closeCash() {
    if (!session) return;
    if (counted === "") { setError("Cuenta el efectivo de la caja e ingresa el monto."); return; }
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc("close_cash_session", { p_session: session.id, p_counted_amount: Number(counted), p_notes: closeNotes || null });
    setBusy(false);
    if (error) { setError(error.message); return; }
    const diff = data.counted_amount - data.expected_cash;
    toast(diff === 0 ? "Caja cerrada y cuadrada" : `Caja cerrada · ${diff > 0 ? "sobran" : "faltan"} ${clp(Math.abs(diff))}`);
    setSheet(null); setCounted(""); setCloseNotes(""); router.refresh();
  }

  const table = tables.find((t) => t.id === tableId);

  return (
    <div className="pos">
      <div className="pos-bar">
        {session ? (
          <>
            <span className="pill ok"><Unlock />Caja abierta desde las {new Date(session.opened_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" })}</span>
            <span className="muted pos-bar-sum">Ventas: <b className="num">{clp(summary.reduce((t, s) => t + s.total, 0))}</b> · Efectivo esperado: <b className="num">{clp(expected)}</b></span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setError(null); setSheet("close"); }}><Lock />Cerrar caja</button>
          </>
        ) : (
          <>
            <span className="pill warn"><Lock />Caja cerrada</span>
            <span className="muted pos-bar-sum">Puedes enviar comandas a cocina. Para cobrar, abre la caja.</span>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => { setError(null); setSheet("open"); }}><Unlock />Abrir caja</button>
          </>
        )}
      </div>

      <div className="pos-grid">
        <section className="pos-catalog">
          <div className="pos-search">
            <Search />
            <input ref={search} className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey}
              placeholder="Buscar o escanear código de barras" aria-label="Buscar producto" autoFocus />
            <ScanBarcode className="scan" aria-hidden />
          </div>
          <div className="seg" role="group" aria-label="Categoría">
            <button type="button" aria-pressed={cat === "all"} onClick={() => setCat("all")}>Todo</button>
            {categories.filter((c) => products.some((p) => p.category_id === c.id)).map((c) => (
              <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</button>
            ))}
          </div>
          <div className="pos-products">
            {list.map((p) => (
              <button key={p.id} type="button" className="pos-prod" disabled={!p.is_available} onClick={() => add(p)}>
                <Thumb name={p.name} src={p.image_url} />
                <span className="nm">{p.name}</span>
                <span className="pr num">{clp(p.price)}{p.unit === "kg" ? "/kg" : ""}</span>
                {!p.is_available && <span className="pill">Agotado</span>}
              </button>
            ))}
            {!list.length && <p className="muted" style={{ padding: 16 }}>No hay productos que coincidan.</p>}
          </div>
        </section>

        <aside className="pos-ticket card">
          <div className="pos-ticket-h">
            <select className="select" value={tableId} onChange={(e) => setTableId(e.target.value)} aria-label="Mesa">
              <option value="">Para llevar / mesón</option>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {lines.length > 0 && <button type="button" className="btn btn-ghost btn-icon" aria-label="Vaciar" onClick={reset}><Trash2 /></button>}
          </div>
          <div className="pos-lines">
            {lines.length === 0 && <p className="muted pos-empty">Toca un producto para agregarlo.</p>}
            {lines.map(({ p, q: n }) => (
              <div className="pos-line" key={p.id}>
                <div className="nm">{p.name}<span>{p.unit === "kg" ? `${qty(n, "kg")} × ${clp(p.price)}` : clp(p.price)}</span></div>
                {p.unit === "kg" ? (
                  <button type="button" className="btn btn-ghost btn-icon" aria-label={`Quitar ${p.name}`} onClick={() => setQty(p.id, 0)}><X /></button>
                ) : (
                  <div className="qty">
                    <button type="button" aria-label="Quitar uno" onClick={() => setQty(p.id, n - 1)}><Minus /></button>
                    <span>{n}</span>
                    <button type="button" aria-label="Agregar uno" onClick={() => setQty(p.id, n + 1)}><Plus /></button>
                  </div>
                )}
                <b className="num">{clp(Math.round(p.price * n))}</b>
              </div>
            ))}
          </div>
          {lines.length > 0 && (
            <div className="pos-extra">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={table ? `Cliente (opcional) · ${table.label}` : "Nombre del cliente (opcional)"} aria-label="Nombre del cliente" />
              <input className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Nota para cocina (opcional)" aria-label="Nota" />
            </div>
          )}
          <div className="pos-total"><span>Total</span><b className="num">{clp(total)}</b></div>
          <div className="pos-actions">
            {(kitchenOn || table) && (
              <button type="button" className="btn btn-ghost btn-lg" disabled={!lines.length || busy} onClick={() => sell(false)}>
                <ChefHat />{table ? `${kitchenOn ? "Comanda a" : "Anotar en"} ${table.label}` : "Enviar a cocina"}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-lg" disabled={!lines.length || !session}
              onClick={() => { setError(null); setPay({ method: "cash", received: null }); setSheet("pay"); }}>
              {session ? `Cobrar ${clp(total)}` : "Abre la caja para cobrar"}
            </button>
          </div>
        </aside>
      </div>

      <Drawer open={sheet === "pay"} title={`Cobrar ${clp(total)}`} onClose={() => setSheet(null)}
        footer={<button className="btn btn-primary btn-lg btn-block" type="button" disabled={busy} onClick={() => sell(true)}>{busy ? "Cobrando…" : "Confirmar cobro"}</button>}>
        <PaymentPicker total={total} value={pay} onChange={setPay} />
        {kitchenOn && (
          <label className="toggle-row"><span><b>Enviar también a cocina</b><small>Para pedidos que se preparan después de cobrar</small></span>
            <span className="switch"><input type="checkbox" checked={alsoKitchen} onChange={(e) => setAlsoKitchen(e.target.checked)} /><span /></span></label>
        )}
        {error && <div className="alert bad" role="alert">{error}</div>}
      </Drawer>

      <Drawer open={sheet === "weight"} title={weighing ? `Peso de ${weighing.p.name}` : ""} onClose={() => setSheet(null)}
        footer={weighing && <button className="btn btn-primary btn-block" type="button"
          onClick={() => { const kg = Number(weighing.kg.replace(",", ".")); if (kg > 0) { add(weighing.p, Math.round(kg * 1000) / 1000); setSheet(null); } }}>
          Agregar {Number(weighing.kg.replace(",", ".")) > 0 ? clp(Math.round(weighing.p.price * Number(weighing.kg.replace(",", ".")))) : ""}</button>}>
        {weighing && (
          <Field label="Kilos" htmlFor="kg" hint={`${clp(weighing.p.price)} por kilo. Ej: 0,75 para 750 g.`}>
            <input className="input" id="kg" inputMode="decimal" value={weighing.kg} onChange={(e) => setWeighing({ ...weighing, kg: e.target.value.replace(/[^\d.,]/g, "") })} />
          </Field>
        )}
      </Drawer>

      <Drawer open={sheet === "open"} title="Abrir caja" onClose={() => setSheet(null)}
        footer={<button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={openCash}>Abrir caja</button>}>
        <Field label="Efectivo inicial en la caja" htmlFor="opening" hint="El sencillo con que partes el turno. Usa 0 si no hay.">
          <div className="input-group"><span>$</span><input id="opening" inputMode="numeric" value={opening} onChange={(e) => setOpening(e.target.value.replace(/\D/g, ""))} placeholder="0" /></div>
        </Field>
        {error && <div className="alert bad">{error}</div>}
      </Drawer>

      <Drawer open={sheet === "close"} title="Cerrar caja" onClose={() => setSheet(null)}
        footer={<button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={closeCash}>Cerrar caja</button>}>
        <div className="sum" style={{ borderTop: 0, paddingTop: 0 }}>
          <div><span className="muted">Efectivo inicial</span><span className="mono">{clp(session?.opening_amount ?? 0)}</span></div>
          {summary.map((s) => (
            <div key={s.payment_method}><span className="muted">{PAYMENT_LABEL[s.payment_method]} · {s.orders} {s.orders === 1 ? "venta" : "ventas"}</span><span className="mono">{clp(s.total)}</span></div>
          ))}
          {!summary.length && <div><span className="muted">Sin ventas en este turno</span><span /></div>}
          <div className="t"><span>Efectivo esperado</span><span className="mono">{clp(expected)}</span></div>
        </div>
        <Field label="Efectivo contado" htmlFor="counted" hint="Cuenta los billetes y monedas que hay en la caja.">
          <div className="input-group"><span>$</span><input id="counted" inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ""))} /></div>
        </Field>
        {counted !== "" && (
          <div className={`change ${Number(counted) - expected < 0 ? "neg" : ""}`}>
            <span>{Number(counted) === expected ? "Cuadra" : Number(counted) > expected ? "Sobran" : "Faltan"}</span>
            <b className="num">{clp(Math.abs(Number(counted) - expected))}</b>
          </div>
        )}
        <Field label="Observaciones" htmlFor="close-notes" hint="Opcional. Ej: retiro de $20.000 para proveedores.">
          <input className="input" id="close-notes" value={closeNotes} maxLength={500} onChange={(e) => setCloseNotes(e.target.value)} />
        </Field>
        {error && <div className="alert bad">{error}</div>}
      </Drawer>
    </div>
  );
}
