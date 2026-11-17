"use client";
import { Bike, Check, Clock, MapPin, MessageCircle, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Thumb } from "@/components/thumb";
import { Drawer, Field } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { clp, DAYS, formatCLPhone, normalizeCLPhone, qty } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PAYMENT_LABEL, type Category, type Fulfillment, type OpeningHour, type PaymentMethod, type Product, type Store } from "@/lib/types";

type Cart = Record<string, number>;
type Placed = { number: number; total: number; token: string; message: string; payment: PaymentMethod };
type Section = { id: string; name: string; items: Product[] };

const step = (p: Product) => (p.unit === "kg" ? 0.25 : 1);
const fmtQty = (p: Product, q: number) => (p.unit === "kg" ? qty(q, "kg") : String(q));
const sellable = (p: Product) => p.is_available && !(p.track_stock && p.stock <= 0);

export function Shop({ store, categories, products, hours, open, tableToken, tableLabel, tableError }: {
  store: Store; categories: Category[]; products: Product[]; hours: OpeningHour[];
  open: { open: boolean; label: string }; tableToken: string | null; tableLabel: string | null; tableError: boolean;
}) {
  const key = `cart:${store.slug}`;
  const [cart, setCart] = useState<Cart>({});
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("");
  const [compact, setCompact] = useState(false);
  const [detail, setDetail] = useState<{ p: Product; q: number } | null>(null);
  const [sheet, setSheet] = useState<"cart" | "done" | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [fulfillment, setFulfillment] = useState<Fulfillment>(tableToken ? "dine_in" : store.pickup_enabled ? "pickup" : "delivery");
  const [payment, setPayment] = useState<PaymentMethod>(store.accepts_transfer ? "transfer" : "cash");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [bump, setBump] = useState(0);
  const headRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Carrito y datos del comprador se recuerdan en este dispositivo.
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(key) ?? "{}") as Cart;
      setCart(Object.fromEntries(Object.entries(c).filter(([id, q]) => q > 0 && products.some((p) => p.id === id && sellable(p)))));
      const f = JSON.parse(localStorage.getItem("buyer") ?? "{}");
      setForm((x) => ({ ...x, name: f.name ?? "", phone: f.phone ?? "", address: f.address ?? "" }));
    } catch { /* almacenamiento no disponible */ }
    setLoaded(true);
  }, [key, products]);
  useEffect(() => {
    if (!loaded) return; // evita borrar el carrito guardado antes de leerlo
    try { localStorage.setItem(key, JSON.stringify(cart)); } catch { /* */ }
  }, [key, cart, loaded]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart).filter(([id, q]) => q > 0 && byId.has(id)).map(([id, q]) => ({ p: byId.get(id)!, q }));
  const count = lines.reduce((t, l) => t + (l.p.unit === "kg" ? 1 : l.q), 0);
  const subtotal = lines.reduce((t, l) => t + Math.round(l.p.price * l.q), 0);
  const fee = fulfillment === "delivery" ? store.delivery_fee : 0;
  const canOrder = open.open && !tableError;

  const sections: Section[] = useMemo(() => {
    const term = query.trim().toLowerCase();
    const match = (p: Product) => !term || p.name.toLowerCase().includes(term) || (p.description ?? "").toLowerCase().includes(term);
    const out: Section[] = categories.map((c) => ({ id: c.id, name: c.name, items: products.filter((p) => p.category_id === c.id && match(p)) }));
    const other = products.filter((p) => (!p.category_id || !categories.some((c) => c.id === p.category_id)) && match(p));
    if (other.length) out.push({ id: "otros", name: out.some((s) => s.items.length) ? "Otros" : "Productos", items: other });
    return out.filter((s) => s.items.length);
  }, [categories, products, query]);

  // Encabezado compacto al hacer scroll.
  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: "-40px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // La categoría activa sigue al scroll.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`cat-${s.id}`)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActiveCat(vis.target.id.slice(4));
    }, { rootMargin: "-120px 0px -60% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  useEffect(() => {
    const btn = navRef.current?.querySelector<HTMLElement>(`[data-cat="${activeCat}"]`);
    btn?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeCat]);

  function jump(id: string) {
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  const add = (p: Product, d: number) => {
    setCart((c) => {
      const n = Math.max(0, Math.round(((c[p.id] ?? 0) + d) * 1000) / 1000);
      const next = { ...c, [p.id]: n };
      if (!n) delete next[p.id];
      return next;
    });
    if (d > 0) setBump((b) => b + 1);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const er: Record<string, string> = {};
    const phone = normalizeCLPhone(form.phone);
    if (!tableToken && !form.name.trim()) er.name = "Escribe tu nombre para que el local sepa de quién es el pedido.";
    if (fulfillment !== "dine_in" && !phone) er.phone = "Ingresa un celular de 9 dígitos que empiece con 9.";
    if (fulfillment === "delivery" && !form.address.trim()) er.address = "Escribe la dirección de entrega.";
    if (!tableToken && subtotal < store.min_order) er.min = `El pedido mínimo es de ${clp(store.min_order)}. Te faltan ${clp(store.min_order - subtotal)}.`;
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true); setServerError(null);
    const { data, error } = await supabaseBrowser().rpc("place_order", {
      p_slug: store.slug,
      p_items: lines.map((l) => ({ product_id: l.p.id, quantity: l.q })),
      p_customer_name: form.name.trim(),
      p_customer_phone: phone,
      p_fulfillment: fulfillment,
      p_payment_method: tableToken ? (store.accepts_cash ? "cash" : "transfer") : payment,
      p_address: fulfillment === "delivery" ? form.address.trim() : null,
      p_note: form.note.trim() || null,
      p_table_token: tableToken,
    });
    setBusy(false);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      setServerError(error?.message && !/^[A-Z0-9_]+$/.test(error.message) && !/fetch/i.test(error.message)
        ? error.message : "No pudimos enviar tu pedido. Revisa tu conexión e inténtalo otra vez.");
      return;
    }
    try { localStorage.setItem("buyer", JSON.stringify({ name: form.name, phone: form.phone, address: form.address })); } catch { /* */ }
    const msg = [
      `*Pedido #${row.order_number}* · ${store.name}`, "",
      ...lines.map((l) => `${qty(l.q, l.p.unit)} ${l.p.name}  ${clp(Math.round(l.p.price * l.q))}`),
      ...(fee ? [`Delivery  ${clp(fee)}`] : []),
      `*Total ${clp(row.total)}*`, "",
      ...(tableLabel ? [`Mesa: ${tableLabel}`] : []),
      ...(form.name.trim() ? [`Cliente: ${form.name.trim()}`] : []),
      ...(phone ? [`Teléfono: ${formatCLPhone(phone)}`] : []),
      `Entrega: ${fulfillment === "delivery" ? "Delivery" : fulfillment === "dine_in" ? "Mesa" : "Retiro"}`,
      ...(fulfillment === "delivery" ? [`Dirección: ${form.address.trim()}`] : []),
      ...(tableToken ? ["Pago: en el local"] : [`Pago: ${PAYMENT_LABEL[payment]}`]),
      ...(form.note.trim() ? [`Nota: ${form.note.trim()}`] : []),
    ].join("\n");
    setPlaced({ number: row.order_number, total: row.total, token: row.public_token, message: msg, payment });
    setCart({}); setForm((f) => ({ ...f, note: "" })); setSheet("done");
  }

  const card = (p: Product) => {
    const inCart = cart[p.id];
    const ok = sellable(p);
    return (
      <article key={p.id} className={`prod ${ok ? "" : "sold"} ${inCart ? "in" : ""}`}>
        <button type="button" className="prod-hit" onClick={() => setDetail({ p, q: inCart || step(p) })} aria-label={`Ver ${p.name}`} />
        <div className="prod-info">
          <b>{p.name}</b>
          {p.description && <p>{p.description}</p>}
          <div className="row">
            <span className="price-t">{clp(p.price)}{p.unit === "kg" ? " /kg" : ""}</span>
            {!ok && <span className="pill">Agotado</span>}
            {inCart ? <span className="pill ok">{fmtQty(p, inCart)} en tu pedido</span> : null}
          </div>
        </div>
        <div className="prod-img">
          <Thumb name={p.name} src={p.image_url} className="prod-thumb" />
          {ok && canOrder && (
            <button className="add" type="button" onClick={() => add(p, step(p))} aria-label={`Agregar ${p.name}`}><Plus /></button>
          )}
        </div>
      </article>
    );
  };

  const hoursText = hours.length
    ? [...hours].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7)).map((h) => `${DAYS[h.weekday].slice(0, 3)} ${h.opens.slice(0, 5)}–${h.closes.slice(0, 5)}`).join(" · ")
    : "sin horario publicado";

  return (
    <div className="shop">
      <div className={`shop-sticky ${compact ? "on" : ""}`} aria-hidden={!compact}>
        <Thumb name={store.name} src={store.logo_url} className="avatar" />
        <b>{store.name}</b>
        <span className={`pill ${open.open ? "ok" : "warn"}`}><span className="dot" />{open.open ? "Abierto" : "Cerrado"}</span>
      </div>

      <div className="shop-cover">{store.cover_url && <img src={store.cover_url} alt="" />}</div>
      <header className="shop-head" ref={headRef}>
        <Thumb name={store.name} src={store.logo_url} className="shop-logo" />
        <div className="shop-title">
          <h1>{store.name}</h1>
          <div className="shop-meta">
            <span className={`pill ${open.open ? "ok" : "warn"}`}><span className="dot" />{open.label}</span>
            {tableLabel && <span className="pill accent">Pedido en {tableLabel}</span>}
            {!tableToken && store.delivery_enabled && <span className="pill"><Bike />Delivery {store.delivery_fee ? clp(store.delivery_fee) : "gratis"}</span>}
            {!tableToken && store.pickup_enabled && <span className="pill"><ShoppingBag />Retiro</span>}
            {!tableToken && store.min_order > 0 && <span className="pill">Mínimo {clp(store.min_order)}</span>}
          </div>
        </div>
        <a className="btn btn-ghost" href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noopener"><MessageCircle />Contactar</a>
      </header>
      {(store.description || store.address) && (
        <div className="shop-info">
          {store.description && <p>{store.description}</p>}
          {store.address && (
            <a className="muted" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.address}, ${store.commune ?? ""}`)}`} target="_blank" rel="noopener">
              <MapPin width={14} height={14} /> {store.address}{store.commune ? `, ${store.commune}` : ""}
            </a>
          )}
        </div>
      )}
      {tableError && <div className="shop-closed"><Clock /><div><b>Este QR de mesa ya no es válido</b><span>Pide ayuda al personal. Puedes revisar la carta mientras tanto.</span></div></div>}
      {!open.open && (
        <div className="shop-closed"><Clock /><div><b>{open.label}</b><span>Puedes revisar la carta. Recibimos pedidos dentro del horario: {hoursText}.</span></div></div>
      )}

      <nav className="cats" aria-label="Categorías" ref={navRef}>
        {products.length > 8 && (
          <label className="cat-search">
            <Search />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar en la carta" />
            {query && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery("")}><X /></button>}
          </label>
        )}
        {sections.length > 1 && sections.map((s) => (
          <button key={s.id} type="button" data-cat={s.id} aria-pressed={activeCat === s.id} onClick={() => jump(s.id)}>{s.name}</button>
        ))}
      </nav>

      {products.length === 0 && <div className="cat-sec"><div className="card empty">Esta tienda todavía no publica productos.</div></div>}
      {products.length > 0 && sections.length === 0 && <div className="cat-sec"><div className="card empty">No encontramos &quot;{query}&quot; en la carta.</div></div>}
      {sections.map((s) => (
        <section className="cat-sec" key={s.id} id={`cat-${s.id}`}>
          <h2>{s.name}<span>{s.items.length}</span></h2>
          <div className="products">{s.items.map(card)}</div>
        </section>
      ))}

      <footer className="shop-foot">Tienda creada con <Link href="/">{BRAND.name}</Link></footer>

      {count > 0 && canOrder && (
        <button className="cartbar" type="button" onClick={() => { setServerError(null); setSheet("cart"); }}>
          <span className="n" key={bump}>{count}</span><span className="sp">Ver mi pedido</span><span className="go">{clp(subtotal)}</span>
        </button>
      )}

      {/* Ficha del producto */}
      <Drawer open={!!detail} title={detail?.p.name ?? ""} onClose={() => setDetail(null)}
        footer={detail && sellable(detail.p) && canOrder ? (
          <button className="btn btn-primary btn-lg btn-block" type="button" onClick={() => {
            const cur = cart[detail.p.id] ?? 0;
            add(detail.p, detail.q - cur);
            setDetail(null);
          }}>
            {cart[detail.p.id] ? "Actualizar pedido" : "Agregar al pedido"} · {clp(Math.round(detail.p.price * detail.q))}
          </button>
        ) : detail ? <span className="muted">{!sellable(detail.p) ? "Producto agotado" : "La tienda no está recibiendo pedidos ahora"}</span> : null}>
        {detail && (
          <>
            <Thumb name={detail.p.name} src={detail.p.image_url} className="detail-img" />
            <div style={{ display: "grid", gap: 6 }}>
              <span className="price-t" style={{ fontSize: 22 }}>{clp(detail.p.price)}{detail.p.unit === "kg" ? " por kilo" : ""}</span>
              {detail.p.description && <p className="muted">{detail.p.description}</p>}
              {detail.p.track_stock && detail.p.stock > 0 && detail.p.stock <= 5 && <span className="pill warn" style={{ justifySelf: "start" }}>Quedan {fmtQty(detail.p, detail.p.stock)}</span>}
            </div>
            {sellable(detail.p) && canOrder && (
              <div className="detail-qty">
                <span className="label">{detail.p.unit === "kg" ? "Cantidad en kilos" : "Cantidad"}</span>
                <div className="qty qty-lg">
                  <button type="button" aria-label="Menos" onClick={() => setDetail({ ...detail, q: Math.max(step(detail.p), Math.round((detail.q - step(detail.p)) * 1000) / 1000) })}><Minus /></button>
                  <span>{fmtQty(detail.p, detail.q)}</span>
                  <button type="button" aria-label="Más" onClick={() => setDetail({ ...detail, q: Math.round((detail.q + step(detail.p)) * 1000) / 1000 })}><Plus /></button>
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      <Drawer open={sheet === "cart"} title="Tu pedido" onClose={() => setSheet(null)}
        footer={<button className="btn btn-primary btn-lg btn-block" form="checkout" disabled={busy || !lines.length}>{busy ? "Enviando…" : `Confirmar pedido · ${clp(subtotal + fee)}`}</button>}>
        <form id="checkout" onSubmit={submit} noValidate style={{ display: "grid", gap: 18 }}>
          {serverError && <div className="alert bad" role="alert">{serverError}</div>}
          <div style={{ display: "grid", gap: 12 }}>
            {lines.map(({ p, q }) => (
              <div className="line" key={p.id}>
                <Thumb name={p.name} src={p.image_url} />
                <div className="nm">{p.name}<span>{clp(Math.round(p.price * q))}</span></div>
                <div className="qty">
                  <button type="button" onClick={() => add(p, -step(p))} aria-label={`Quitar ${p.name}`}><Minus /></button>
                  <span>{fmtQty(p, q)}</span>
                  <button type="button" onClick={() => add(p, step(p))} aria-label={`Agregar ${p.name}`}><Plus /></button>
                </div>
              </div>
            ))}
            {!lines.length && <p className="muted">Tu pedido está vacío.</p>}
          </div>
          {!tableToken && store.pickup_enabled && store.delivery_enabled && (
            <div className="field"><span className="label">¿Cómo lo recibes?</span>
              <div className="seg" role="group">
                <button type="button" aria-pressed={fulfillment === "pickup"} onClick={() => setFulfillment("pickup")}>Retiro en local</button>
                <button type="button" aria-pressed={fulfillment === "delivery"} onClick={() => setFulfillment("delivery")}>Delivery · {store.delivery_fee ? clp(store.delivery_fee) : "gratis"}</button>
              </div>
            </div>
          )}
          <div className="form-grid">
            <Field label={tableToken ? "Tu nombre (opcional)" : "Tu nombre"} htmlFor="c-name" error={errors.name}>
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
            {!tableToken && (
              <div className="field full"><span className="label">Pago</span>
                <div className="seg" role="group" aria-label="Medio de pago">
                  {store.accepts_transfer && <button type="button" aria-pressed={payment === "transfer"} onClick={() => setPayment("transfer")}>Transferencia</button>}
                  {store.accepts_cash && <button type="button" aria-pressed={payment === "cash"} onClick={() => setPayment("cash")}>Efectivo</button>}
                </div>
              </div>
            )}
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
        footer={placed && !tableToken && (
          <a className="btn btn-primary btn-lg btn-block" target="_blank" rel="noopener"
            href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(placed.message)}`}><MessageCircle />Enviar resumen por WhatsApp</a>
        )}>
        {placed && (
          <>
            <div className="done-head"><span className="done-ic"><Check /></span>
              <div><b>Pedido #{placed.number} · {clp(placed.total)}</b><p className="muted">{tableLabel ? `Llegó a cocina para ${tableLabel}. Pagas en el local al terminar.` : `${store.name} ya lo ve en su pantalla.`}</p></div>
            </div>
            {!tableToken && placed.payment === "transfer" && store.transfer_details && (
              <div className="card" style={{ padding: 16 }}><span className="eyebrow">Datos para transferir</span>
                <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{store.transfer_details}</p></div>
            )}
            <Link className="btn btn-ghost" href={`/pedido/${placed.token}`}>Seguir el estado de mi pedido</Link>
            {!tableToken && <p className="muted" style={{ fontSize: 13 }}>Enviar el resumen por WhatsApp es opcional; sirve para conversar directo con el local.</p>}
          </>
        )}
      </Drawer>
    </div>
  );
}
