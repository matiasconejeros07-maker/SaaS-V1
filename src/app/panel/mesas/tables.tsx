"use client";
import { Plus, Printer, QrCode, Receipt, Trash2, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Drawer, Field, useToast } from "@/components/ui";
import { agoLabel, clp, qty } from "@/lib/format";
import { qrSvg, tableUrl } from "@/lib/qr";
import { supabaseBrowser } from "@/lib/supabase/client";
import { STATUS_LABEL, type DiningTable, type Order, type PaymentMethod } from "@/lib/types";
import { PaymentPicker } from "../caja/payment";

type Mode = { kind: "qr" | "bill" | "edit"; table: DiningTable } | { kind: "add" } | null;

export function TablesManager({ storeId, slug, tables, orders, hasOpenCash, canEdit }: {
  storeId: string; slug: string; tables: DiningTable[]; orders: Order[]; hasOpenCash: boolean; canEdit: boolean;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState("");
  const [count, setCount] = useState("6");
  const [label, setLabel] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pay, setPay] = useState<{ method: PaymentMethod; received: number | null }>({ method: "cash", received: null });

  // Se actualiza solo cuando cambia un pedido de la tienda.
  useEffect(() => {
    const ch = supabase.channel(`tables-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` }, () => router.refresh())
      .subscribe();
    const poll = setInterval(() => router.refresh(), 20000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [supabase, storeId, router]);

  const byTable = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of orders) if (o.table_id) m.set(o.table_id, [...(m.get(o.table_id) ?? []), o]);
    return m;
  }, [orders]);

  useEffect(() => {
    if (mode?.kind === "qr") qrSvg(tableUrl(slug, mode.table.token)).then(setSvg);
  }, [mode, slug]);

  function open(m: Mode) {
    setError(null); setConfirmDelete(false); setPay({ method: "cash", received: null });
    if (m && m.kind === "edit") setLabel(m.table.label);
    setMode(m);
  }

  async function addTables() {
    const n = Math.min(60, Math.max(1, Number(count) || 0));
    const used = new Set(tables.map((t) => t.label.toLowerCase()));
    const rows: { store_id: string; label: string }[] = [];
    for (let i = 1; rows.length < n && i < 500; i++) {
      const l = `Mesa ${i}`;
      if (!used.has(l.toLowerCase())) rows.push({ store_id: storeId, label: l });
    }
    setBusy(true);
    const { error } = await supabase.from("tables").insert(rows);
    setBusy(false);
    if (error) { setError("No se pudieron crear las mesas."); return; }
    toast(`${rows.length} ${rows.length === 1 ? "mesa creada" : "mesas creadas"}`); setMode(null); router.refresh();
  }

  async function rename(t: DiningTable) {
    if (!label.trim()) { setError("Escribe un nombre para la mesa."); return; }
    setBusy(true);
    const { error } = await supabase.from("tables").update({ label: label.trim() }).eq("id", t.id);
    setBusy(false);
    if (error) { setError(/unique|duplicate/i.test(error.message) ? "Ya existe una mesa con ese nombre." : "No se pudo guardar."); return; }
    toast("Mesa actualizada"); setMode(null); router.refresh();
  }

  async function remove(t: DiningTable) {
    setBusy(true);
    const { error } = await supabase.from("tables").delete().eq("id", t.id);
    setBusy(false);
    if (error) { setError("No se pudo eliminar la mesa."); return; }
    toast("Mesa eliminada"); setMode(null); router.refresh();
  }

  async function settle(t: DiningTable, total: number) {
    if (pay.method === "cash" && pay.received !== null && pay.received < total) { setError("El efectivo recibido es menor que el total."); return; }
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc("settle_table", { p_table: t.id, p_payment_method: pay.method, p_cash_received: pay.method === "cash" ? pay.received : null });
    setBusy(false);
    if (error) { setError(error.message); return; }
    const r = Array.isArray(data) ? data[0] : data;
    toast(r?.change > 0 ? `${t.label} cobrada · vuelto ${clp(r.change)}` : `${t.label} cobrada`);
    setMode(null); router.refresh();
  }

  const tableOrders = (id: string) => byTable.get(id) ?? [];
  const due = (id: string) => tableOrders(id).filter((o) => o.payment_status === "pending").reduce((t, o) => t + o.total, 0);
  const current = mode && "table" in mode ? mode.table : null;

  return (
    <>
      <div className="page-h">
        <div><h1>Mesas</h1><p>{tables.length} {tables.length === 1 ? "mesa" : "mesas"} · {tables.filter((t) => tableOrders(t.id).length).length} ocupadas</p></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {tables.length > 0 && <Link className="btn btn-ghost" href="/panel/mesas/imprimir" target="_blank"><Printer />Imprimir QR</Link>}
          {canEdit && <button className="btn btn-primary" type="button" onClick={() => open({ kind: "add" })}><Plus />Agregar mesas</button>}
        </div>
      </div>

      {!hasOpenCash && tables.some((t) => due(t.id) > 0) && (
        <div className="alert warn">La caja está cerrada. <Link href="/panel/caja">Ábrela</Link> para poder cobrar las mesas.</div>
      )}

      {tables.length === 0 ? (
        <section className="card empty">
          Aún no tienes mesas. Crea tus mesas, imprime sus QR y pégalos en cada una.
          {canEdit && <button className="btn btn-primary btn-sm" type="button" onClick={() => open({ kind: "add" })}><Plus />Crear mesas</button>}
        </section>
      ) : (
        <div className="tables-grid">
          {tables.map((t) => {
            const os = tableOrders(t.id);
            const busyT = os.length > 0;
            const amount = due(t.id);
            const kitchen = os.filter((o) => ["new", "preparing"].includes(o.status)).length;
            const ready = os.filter((o) => o.status === "ready").length;
            const since = os.length ? os.reduce((a, o) => (o.created_at < a ? o.created_at : a), os[0].created_at) : null;
            return (
              <article key={t.id} className={`table-card ${busyT ? "busy" : ""}`}>
                <div className="table-top">
                  <b>{t.label}</b>
                  <span className={`pill ${busyT ? "warn" : "ok"}`}><span className="dot" />{busyT ? "Ocupada" : "Libre"}</span>
                </div>
                {busyT ? (
                  <div className="table-mid">
                    <span className="amount num">{clp(amount)}</span>
                    <span className="muted">por cobrar · hace {agoLabel(since!)}</span>
                    <span className="table-tags">
                      {kitchen > 0 && <span className="pill info">{kitchen} en cocina</span>}
                      {ready > 0 && <span className="pill ok">{ready} {ready === 1 ? "lista" : "listas"} para servir</span>}
                    </span>
                  </div>
                ) : <div className="table-mid"><span className="muted">Sin pedidos</span></div>}
                <div className="table-actions">
                  <Link className="btn btn-soft btn-sm" href={`/panel/caja?mesa=${t.id}`}><UtensilsCrossed />Tomar pedido</Link>
                  {amount > 0 && <button className="btn btn-primary btn-sm" type="button" onClick={() => open({ kind: "bill", table: t })}><Receipt />Cobrar</button>}
                  <button className="btn btn-ghost btn-icon" type="button" aria-label={`QR de ${t.label}`} onClick={() => open({ kind: "qr", table: t })}><QrCode /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Drawer open={mode?.kind === "add"} title="Agregar mesas" onClose={() => setMode(null)}
        footer={<><button className="btn btn-ghost" type="button" onClick={() => setMode(null)}>Cancelar</button>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={addTables}>Crear mesas</button></>}>
        <Field label="¿Cuántas mesas?" htmlFor="t-count" hint="Se numeran solas (Mesa 1, Mesa 2…). Después puedes renombrarlas, por ejemplo “Terraza 1”.">
          <input className="input" id="t-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
        </Field>
        {error && <div className="alert bad">{error}</div>}
      </Drawer>

      <Drawer open={mode?.kind === "qr"} title={current ? `QR · ${current.label}` : ""} onClose={() => setMode(null)}
        footer={current && canEdit && <button className="btn btn-ghost" type="button" style={{ marginRight: "auto" }} onClick={() => open({ kind: "edit", table: current })}>Renombrar o eliminar</button>}>
        {current && (
          <>
            <div className="qr-box" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="muted" style={{ fontSize: 13 }}>Al escanearlo, el cliente ve tu carta y su pedido llega marcado como {current.label}. Puedes probarlo con tu celular.</p>
            <a className="btn btn-soft" href={tableUrl(slug, current.token)} target="_blank" rel="noopener">Abrir la carta de esta mesa</a>
          </>
        )}
      </Drawer>

      <Drawer open={mode?.kind === "edit"} title="Editar mesa" onClose={() => setMode(null)}
        footer={current && (confirmDelete ? (<>
          <span className="muted" style={{ marginRight: "auto", fontSize: 13 }}>¿Eliminar {current.label}? Su QR dejará de funcionar.</span>
          <button className="btn btn-ghost" type="button" onClick={() => setConfirmDelete(false)}>No</button>
          <button className="btn btn-danger" type="button" disabled={busy} onClick={() => remove(current)}>Sí, eliminar</button>
        </>) : (<>
          <button className="btn btn-ghost btn-icon" type="button" aria-label="Eliminar mesa" style={{ marginRight: "auto" }} onClick={() => setConfirmDelete(true)}><Trash2 /></button>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => rename(current)}>Guardar</button>
        </>))}>
        <Field label="Nombre de la mesa" htmlFor="t-label"><input className="input" id="t-label" value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} /></Field>
        {error && <div className="alert bad">{error}</div>}
      </Drawer>

      <Drawer open={mode?.kind === "bill"} title={current ? `Cobrar ${current.label}` : ""} onClose={() => setMode(null)}
        footer={current && <button className="btn btn-primary btn-lg btn-block" type="button" disabled={busy || !hasOpenCash} onClick={() => settle(current, due(current.id))}>
          {busy ? "Cobrando…" : `Cobrar ${clp(due(current.id))}`}</button>}>
        {current && (
          <>
            {!hasOpenCash && <div className="alert warn">Abre la caja para poder cobrar.</div>}
            {tableOrders(current.id).filter((o) => o.payment_status === "pending").map((o) => (
              <div key={o.id} className="bill-order">
                <div className="bill-h"><b>#{o.number}</b><span className="pill">{STATUS_LABEL[o.status]}</span><span className="mono">{clp(o.total)}</span></div>
                <ul>{o.order_items?.map((i) => <li key={i.id}><span>{qty(i.quantity, i.unit)} {i.name}</span><span className="mono">{clp(i.line_total)}</span></li>)}</ul>
              </div>
            ))}
            <div className="sum"><div className="t"><span>Total</span><span className="mono">{clp(due(current.id))}</span></div></div>
            <PaymentPicker total={due(current.id)} value={pay} onChange={setPay} />
            {error && <div className="alert bad">{error}</div>}
          </>
        )}
      </Drawer>
    </>
  );
}
