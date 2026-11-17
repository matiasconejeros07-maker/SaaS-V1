"use client";
import { Bike, Check, Clock, MapPin, MessageCircle, Minus, Package, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Drawer, Field } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { clp, DAYS, formatCLPhone, normalizeCLPhone, qty } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PAYMENT_LABEL, type Category, type Fulfillment, type OpeningHour, type PaymentMethod, type Product, type Store } from "@/lib/types";

type Cart = Record<string, number>;
type Placed = { number: number; total: number; token: string; message: string; payment: PaymentMethod };

export function Shop({ store, categories, products, hours, open, tableToken }: {
  store: Store; categories: Category[]; products: Product[]; hours: OpeningHour[];
  open: { open: boolean; label: string }; tableToken: string | null;
}) {
  const key = `cart:${store.slug}`;
  const [cart, setCart] = useState<Cart>({});
  const [active, setActive] = useState("all");
  const [sheet, setSheet] = useState<"cart" | "done" | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [fulfillment, setFulfillment] = useState<Fulfillment>(tableToken ? "dine_in" : store.pickup_enabled ? "pickup" : "delivery");
  const [payment, setPayment] = useState<PaymentMethod>(store.accepts_transfer ? "transfer" : "cash");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<Placed | null>(null);

  // Carrito y datos del cliente se recuerdan en este dispositivo.
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(key) ?? "{}");
      const valid = Object.fromEntries(Object.entries(c).filter(([id]) => products.some((p) => p.id === id && p.is_available))) as Cart;
      setCart(valid);
      const f = JSON.parse(localStorage.getItem("buyer") ?? "{}");
      setForm((x) => ({ ...x, name: f.name ?? "", phone: f.phone ?? "", address: f.address ?? "" }));
    } catch { /* almacenamiento no disponible */ }
  }, [key, products]);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(cart)); } catch { /* */ } }, [key, cart]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart).filter(([id, q]) => q > 0 && byId.has(id)).map(([id, q]) => ({ p: byId.get(id)!, q }));
  const count = lines.reduce((t, l) => t + (l.p.unit === "kg" ? 1 : l.q), 0);
  const subtotal = lines.reduce((t, l) => t + Math.round(l.p.price * l.q), 0);
  const fee = fulfillment === "delivery" ? store.delivery_fee : 0;
  const sections = categories.filter((c) => products.some((p) => p.category_id === c.id));
  const uncategorized = products.filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id));
  const step = (p: Product) => (p.unit === "kg" ? 0.5 : 1);

  const add = (p: Product, d: number) => setCart((c) => {
    const n = Math.max(0, Math.round(((c[p.id] ?? 0) + d) * 1000) / 1000);
    const next = { ...c, [p.id]: n };
    if (!n) delete next[p.id];
    return next;
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    const phone = normalizeCLPhone(form.phone);
    if (!form.name.trim()) er.name = "Escribe tu nombre para que el local sepa de quién es el pedido.";
    if (fulfillment !== "dine_in" && !phone) er.phone = "Ingresa un celular de 9 dígitos que empiece con 9.";
    if (fulfillment === "delivery" && !form.address.trim()) er.address = "Escribe la dirección de entrega.";
    if (subtotal < store.min_order) er.min = `El pedido mínimo es de ${clp(store.min_order)}.`;
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true); setServerError(null);
    const { data, error } = await supabaseBrowser().rpc("place_order", {
      p_slug: store.slug,
      p_items: lines.map((l) => ({ product_id: l.p.id, quantity: l.q })),
      p_customer_name: form.name.trim(),
      p_customer_phone: phone,
      p_fulfillment: fulfillment,
      p_payment_method: payment,
      p_address: fulfillment === "delivery" ? form.address.trim() : null,
      p_note: form.note.trim() || null,
      p_table_token: tableToken,
    });
    setBusy(false);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      setServerError(error?.message && !/^[A-Z0-9_]+$/.test(error.message) ? error.message : "No pudimos enviar tu pedido. Revisa tu conexión e inténtalo otra vez.");
      return;
    }
    try { localStorage.setItem("buyer", JSON.stringify({ name: form.name, phone: form.phone, address: form.address })); } catch { /* */ }
    const msg = [
      `*Pedido #${row.order_number}* · ${store.name}`, "",
      ...lines.map((l) => `${qty(l.q, l.p.unit)} ${l.p.name}  ${clp(Math.round(l.p.price * l.q))}`),
      ...(fee ? [`Delivery  ${clp(fee)}`] : []),
      `*Total ${clp(row.total)}*`, "",
      `Cliente: ${form.name.trim()}`,
      ...(phone ? [`Teléfono: ${formatCLPhone(phone)}`] : []),
      `Entrega: ${fulfillment === "delivery" ? "Delivery" : fulfillment === "dine_in" ? "Mesa" : "Retiro"}`,
      ...(fulfillment === "delivery" ? [`Dirección: ${form.address.trim()}`] : []),
      `Pago: ${PAYMENT_LABEL[payment]}`,
      ...(form.note.trim() ? [`Nota: ${form.note.trim()}`] : []),
    ].join("\n");
    setPlaced({ number: row.order_number, total: row.total, token: row.public_token, message: msg, payment });
    setCart({}); setForm((f) => ({ ...f, note: "" })); setSheet("done");
  }

  const card = (p: Product) => {
    const inCart = cart[p.id];
    return (
      <article key={p.id} className={`prod ${p.is_available ? "" : "sold"}`}>
        <div className="prod-info">
          <b>{p.name}</b>
          {p.description && <p>{p.description}</p>}
          <div className="row">
            <span className="price-t">{clp(p.price)}{p.unit === "kg" ? " /kg" : ""}</span>
            {!p.is_available && <span className="pill">Agotado</span>}
          </div>
        </div>
        <div className="prod-img">
          {p.image_url ? <img src={p.image_url} alt="" loading="lazy" /> : <Package />}
          {p.is_available && open.open && (inCart ? (
            <div className="qty on-img">
              <button type="button" onClick={() => add(p, -step(p))} aria-label={`Quitar ${p.name}`}><Minus /></button>
              <span>{p.unit === "kg" ? inCart : inCart}</span>
              <button type="button" onClick={() => add(p, step(p))} aria-label={`Agregar ${p.name}`}><Plus /></button>
            </div>
          ) : (
            <button className="add" type="button" onClick={() => add(p, step(p))} aria-label={`Agregar ${p.name}`}><Plus /></button>
          ))}
        </div>
      </article>
    );
  };

  return (
    <div className="shop">
      <div className="shop-cover">{store.cover_url && <img src={store.cover_url} alt="" />}</div>
      <header className="shop-head">
        <div className="shop-logo">{store.logo_url ? <img src={store.logo_url} alt="" /> : store.name[0]?.toUpperCase()}</div>
        <div className="shop-title">
          <h1>{store.name}</h1>
          <div className="shop-meta">
            <span className={`pill ${open.open ? "ok" : "warn"}`}><span className="dot" />{open.label}</span>
            {tableToken && <span className="pill accent">Pedido en mesa</span>}
            {!tableToken && store.delivery_enabled && <span className="pill"><Bike />Delivery {store.delivery_fee ? clp(store.delivery_fee) : "gratis"}</span>}
            {!tableToken && store.pickup_enabled && <span className="pill"><ShoppingBag />Retiro</span>}
            {store.commune && <span className="pill"><MapPin />{store.commune}</span>}
          </div>
        </div>
        <a className="btn btn-ghost" href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noopener"><MessageCircle />Contactar</a>
      </header>
      {(store.description || store.address) && (
        <div className="shop-info">
          {store.description && <p>{store.description}</p>}
          {store.address && <a className="muted" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.address}, ${store.commune ?? ""}`)}`} target="_blank" rel="noopener"><MapPin width={14} height={14} /> {store.address}{store.commune ? `, ${store.commune}` : ""}</a>}
        </div>
      )}
      {!open.open && (
        <div className="shop-closed"><Clock />
          <div><b>{open.label}</b><span>Puedes revisar el catálogo. Los pedidos se reciben dentro del horario: {hours.length ? [...hours].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7)).map((h) => `${DAYS[h.weekday].slice(0, 3)} ${h.opens.slice(0, 5)}–${h.closes.slice(0, 5)}`).join(" · ") : "sin horario publicado"}.</span></div>
        </div>
      )}

      {(sections.length > 1 || (sections.length && uncategorized.length)) && (
        <nav className="cats" aria-label="Categorías">
          <button type="button" aria-pressed={active === "all"} onClick={() => setActive("all")}>Todo</button>
          {sections.map((c) => <button key={c.id} type="button" aria-pressed={active === c.id} onClick={() => setActive(c.id)}>{c.name}</button>)}
        </nav>
      )}

      {products.length === 0 && <div className="cat-sec"><div className="card empty">Esta tienda todavía no publica productos.</div></div>}
      {sections.filter((c) => active === "all" || active === c.id).map((c) => (
        <section className="cat-sec" key={c.id}>
          <h2>{c.name}</h2>
          <div className="products">{products.filter((p) => p.category_id === c.id).map(card)}</div>
        </section>
      ))}
      {active === "all" && uncategorized.length > 0 && (
        <section className="cat-sec">
          {sections.length > 0 && <h2>Otros</h2>}
          <div className="products">{uncategorized.map(card)}</div>
        </section>
      )}

      <footer className="shop-foot">Tienda creada con <Link href="/">{BRAND.name}</Link></footer>

      {count > 0 && open.open && (
        <button className="cartbar" type="button" onClick={() => { setServerError(null); setSheet("cart"); }}>
          <span className="n">{count}</span><span className="sp">Ver mi pedido</span><span className="go">{clp(subtotal)}</span>
        </button>
      )}

      <Drawer open={sheet === "cart"} title="Tu pedido" onClose={() => setSheet(null)}
        footer={<button className="btn btn-primary btn-lg btn-block" form="checkout" disabled={busy || !lines.length}>{busy ? "Enviando…" : `Confirmar pedido · ${clp(subtotal + fee)}`}</button>}>
        <form id="checkout" onSubmit={submit} noValidate style={{ display: "grid", gap: 18 }}>
          {serverError && <div className="alert bad" role="alert">{serverError}</div>}
          <div style={{ display: "grid", gap: 12 }}>
            {lines.map(({ p, q }) => (
              <div className="line" key={p.id}>
                <div className="thumb">{p.image_url ? <img src={p.image_url} alt="" /> : <Package />}</div>
                <div className="nm">{p.name}<span>{clp(Math.round(p.price * q))}</span></div>
                <div className="qty">
                  <button type="button" onClick={() => add(p, -step(p))} aria-label="Quitar"><Minus /></button>
                  <span>{p.unit === "kg" ? `${q} kg` : q}</span>
                  <button type="button" onClick={() => add(p, step(p))} aria-label="Agregar"><Plus /></button>
                </div>
              </div>
            ))}
          </div>
          {!tableToken && store.pickup_enabled && store.delivery_enabled && (
            <div className="field"><span className="label">¿Cómo lo recibes?</span>
              <div className="seg" role="group">
                <button type="button" aria-pressed={fulfillment === "pickup"} onClick={() => setFulfillment("pickup")}>Retiro en local</button>
                <button type="button" aria-pressed={fulfillment === "delivery"} onClick={() => setFulfillment("delivery")}>Delivery</button>
              </div>
            </div>
          )}
          <div className="form-grid">
            <Field label={tableToken ? "Tu nombre o número de mesa" : "Tu nombre"} htmlFor="c-name" error={errors.name}>
              <input className="input" id="c-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            {fulfillment !== "dine_in" && (
              <Field label="Celular" htmlFor="c-phone" error={errors.phone}>
                <div className="input-group"><span>+56</span><input id="c-phone" inputMode="tel" autoComplete="tel-national" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9 1234 5678" /></div>
              </Field>
            )}
            {fulfillment === "delivery" && (
              <Field className="full" label="Dirección de entrega" htmlFor="c-addr" error={errors.address} hint="Calle, número, depto y comuna.">
                <input className="input" id="c-addr" autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
            )}
            <Field className="full" label="Pago" htmlFor="c-pay">
              <select className="select" id="c-pay" value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
                {store.accepts_transfer && <option value="transfer">Transferencia</option>}
                {store.accepts_cash && <option value="cash">Efectivo</option>}
              </select>
            </Field>
            <Field className="full" label="Nota para el local" htmlFor="c-note" hint="Opcional. Ej: sin cebolla.">
              <input className="input" id="c-note" maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </div>
          <div className="sum">
            <div><span className="muted">Subtotal</span><span className="mono">{clp(subtotal)}</span></div>
            {fee > 0 && <div><span className="muted">Delivery</span><span className="mono">{clp(fee)}</span></div>}
            <div className="t"><span>Total</span><span className="mono">{clp(subtotal + fee)}</span></div>
            {errors.min && <span className="err">{errors.min}</span>}
          </div>
        </form>
      </Drawer>

      <Drawer open={sheet === "done" && !!placed} title="¡Pedido recibido!" onClose={() => setSheet(null)}
        footer={placed && (
          <a className="btn btn-primary btn-lg btn-block" target="_blank" rel="noopener"
            href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(placed.message)}`}><MessageCircle />Enviar resumen por WhatsApp</a>
        )}>
        {placed && (
          <>
            <div className="done-head"><span className="done-ic"><Check /></span>
              <div><b>Pedido #{placed.number} · {clp(placed.total)}</b><p className="muted">{store.name} ya lo ve en su pantalla.</p></div>
            </div>
            {placed.payment === "transfer" && store.transfer_details && (
              <div className="card" style={{ padding: 16 }}><span className="eyebrow">Datos para transferir</span>
                <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{store.transfer_details}</p></div>
            )}
            <Link className="btn btn-ghost" href={`/pedido/${placed.token}`}>Seguir el estado de mi pedido</Link>
            <p className="muted" style={{ fontSize: 13 }}>Enviar el resumen por WhatsApp es opcional; sirve para conversar directo con el local.</p>
          </>
        )}
      </Drawer>
    </div>
  );
}
