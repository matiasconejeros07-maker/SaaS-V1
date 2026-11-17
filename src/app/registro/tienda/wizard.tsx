"use client";
import { ArrowLeft, ArrowRight, Bike, Check, MessageCircle, Package, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Field, Logo } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { clp, DAYS, normalizeCLPhone, slugify } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BUSINESS_TYPES } from "@/lib/types";

type Hour = { weekday: number; open: boolean; opens: string; closes: string };
const STEPS = ["Tu negocio", "Pedidos", "Horario", "Primer producto"] as const;
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const RESERVED = new Set(["panel", "ingresar", "registro", "salir", "api", "admin", "auth", "app", "www", "soporte", "ayuda", "precios",
  "legal", "tiendas", "static", "cocina", "pedido", "pedidos", "caja", "mesas", "tienda", "cuenta", "login", "signup"]);

export function Wizard({ ownerName }: { ownerName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [type, setType] = useState("");
  const [phone, setPhone] = useState("");
  const [pickup, setPickup] = useState(true);
  const [delivery, setDelivery] = useState(false);
  const [fee, setFee] = useState("1500");
  const [hours, setHours] = useState<Hour[]>(
    ORDER.map((d) => ({ weekday: d, open: d >= 1 && d <= 5, opens: "09:00", closes: "19:00" })),
  );
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pCat, setPCat] = useState("");

  const wa = normalizeCLPhone(phone);
  const openDays = hours.filter((h) => h.open).length;
  const groups = useMemo(() => [...new Set(BUSINESS_TYPES.map((b) => b.group))], []);

  function validate(s: number) {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (name.trim().length < 2) e.name = "Escribe el nombre de tu negocio (mínimo 2 letras).";
      if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) e.slug = "Usa solo letras minúsculas, números y guiones.";
      else if (RESERVED.has(slug)) e.slug = "Ese enlace está reservado. Agrega el nombre de tu negocio, por ejemplo cocina-de-ana.";
      if (!type) e.type = "Elige el tipo de negocio.";
    }
    if (s === 1) {
      if (!wa) e.phone = "Ingresa un celular de 9 dígitos que empiece con 9, por ejemplo 9 1234 5678.";
      if (!pickup && !delivery) e.delivery = "Activa al menos una forma de entrega.";
    }
    if (s === 2) {
      if (!openDays) e.hours = "Activa al menos un día de atención.";
      if (hours.some((h) => h.open && h.opens >= h.closes)) e.hours = "La hora de cierre debe ser posterior a la de apertura.";
    }
    if (s === 3 && pName.trim() && !(Number(pPrice) > 0)) e.pPrice = "Ingresa un precio mayor a $0.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function finish(skipProduct: boolean) {
    if (!skipProduct && !validate(3)) return;
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { data: store, error: err } = await supabase.rpc("create_store", {
      p_name: name.trim(),
      p_slug: slug,
      p_whatsapp: wa,
      p_business_type: type,
      p_pickup: pickup,
      p_delivery: delivery,
      p_delivery_fee: delivery ? Number(fee) || 0 : 0,
      p_hours: hours.filter((h) => h.open).map(({ weekday, opens, closes }) => ({ weekday, opens, closes })),
    });
    if (err || !store) {
      setBusy(false);
      const m = err?.message ?? "";
      if (/enlace/i.test(m)) { setStep(0); setErrors({ slug: m }); return; }
      setError(m && !/^[A-Z_]+$/.test(m) ? m : "No pudimos crear tu tienda. Inténtalo de nuevo.");
      return;
    }
    if (!skipProduct && pName.trim()) {
      let categoryId: string | null = null;
      if (pCat.trim()) {
        const { data: c } = await supabase.from("categories").insert({ store_id: store.id, name: pCat.trim() }).select("id").single();
        categoryId = c?.id ?? null;
      }
      await supabase.from("products").insert({ store_id: store.id, category_id: categoryId, name: pName.trim(), price: Number(pPrice) });
    }
    router.replace("/panel?bienvenida=1");
    router.refresh();
  }

  function next() {
    if (!validate(step)) return;
    if (step === STEPS.length - 1) finish(false);
    else setStep(step + 1);
  }

  const setHour = (d: number, patch: Partial<Hour>) => setHours((hs) => hs.map((h) => (h.weekday === d ? { ...h, ...patch } : h)));

  return (
    <div className="onb">
      <div className="onb-main">
        <div className="onb-inner">
          <Logo />
          <ol className="stepper" aria-label="Pasos">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? "done" : i === step ? "cur" : ""} aria-current={i === step ? "step" : undefined}>
                <button type="button" disabled={i >= step} onClick={() => setStep(i)}>{i + 1}. {s}</button>
              </li>
            ))}
          </ol>

          <form onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
            {error && <div className="alert bad" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

            {step === 0 && (
              <section>
                <h1>{ownerName ? `Hola, ${ownerName}. ` : ""}Cuéntanos de tu negocio</h1>
                <p className="sub">Con esto creamos tu tienda y el enlace que compartirás.</p>
                <div className="form-grid">
                  <Field className="full" label="Nombre del negocio" htmlFor="name" error={errors.name}>
                    <input className="input" id="name" value={name} autoComplete="organization" placeholder="Ej: Krutz Pizzería"
                      onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
                  </Field>
                  <Field className="full" label="Enlace de tu tienda" htmlFor="slug" error={errors.slug} hint="Se crea solo a partir del nombre. Puedes cambiarlo.">
                    <div className="input-group">
                      <span>{BRAND.domain}/</span>
                      <input id="slug" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} placeholder="krutz-pizzeria" />
                    </div>
                  </Field>
                  <Field className="full" label="Tipo de negocio" htmlFor="type" error={errors.type}>
                    <select className="select" id="type" value={type} onChange={(e) => setType(e.target.value)}>
                      <option value="">Elige una opción</option>
                      {groups.map((g) => (
                        <optgroup key={g} label={g}>
                          {BUSINESS_TYPES.filter((b) => b.group === g).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                </div>
              </section>
            )}

            {step === 1 && (
              <section>
                <h1>¿Cómo recibes los pedidos?</h1>
                <p className="sub">Cada pedido llega a tu panel en tiempo real y además a este WhatsApp.</p>
                <div className="form-grid">
                  <Field className="full" label="WhatsApp del negocio" htmlFor="phone" error={errors.phone}
                    hint={wa ? `Los pedidos llegarán a +56 9 ${wa.slice(3, 7)} ${wa.slice(7)}` : "Celular chileno de 9 dígitos."}>
                    <div className="input-group">
                      <span>+56</span>
                      <input id="phone" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9 1234 5678" />
                    </div>
                  </Field>
                  <div className="full" style={{ display: "grid", gap: 10 }}>
                    <span className="label">Entrega</span>
                    <label className="toggle-row"><span><b>Retiro en el local</b><small>El cliente pasa a buscar su pedido</small></span>
                      <span className="switch"><input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} /><span /></span></label>
                    <label className="toggle-row"><span><b>Delivery</b><small>El cliente escribe su dirección al pedir</small></span>
                      <span className="switch"><input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} /><span /></span></label>
                    {errors.delivery && <span className="err">{errors.delivery}</span>}
                  </div>
                  {delivery && (
                    <Field label="Costo del delivery" htmlFor="fee" hint="Usa 0 para delivery gratis.">
                      <div className="input-group"><span>$</span>
                        <input id="fee" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} />
                      </div>
                    </Field>
                  )}
                </div>
              </section>
            )}

            {step === 2 && (
              <section>
                <h1>¿Cuándo atiendes?</h1>
                <p className="sub">Fuera de este horario tu tienda muestra &quot;Cerrado&quot; y no recibe pedidos.</p>
                <div className="hours">
                  {hours.map((h) => (
                    <div className="hour-row" key={h.weekday}>
                      <b>{DAYS[h.weekday]}</b>
                      <span className="switch"><input type="checkbox" aria-label={`Abre el ${DAYS[h.weekday]}`} checked={h.open} onChange={(e) => setHour(h.weekday, { open: e.target.checked })} /><span /></span>
                      <span className="times">
                        {h.open ? (<>
                          <input type="time" aria-label={`Apertura ${DAYS[h.weekday]}`} value={h.opens} onChange={(e) => setHour(h.weekday, { opens: e.target.value })} />
                          a
                          <input type="time" aria-label={`Cierre ${DAYS[h.weekday]}`} value={h.closes} onChange={(e) => setHour(h.weekday, { closes: e.target.value })} />
                        </>) : "Cerrado"}
                      </span>
                    </div>
                  ))}
                </div>
                {errors.hours && <p className="err" style={{ marginTop: 8 }}>{errors.hours}</p>}
                <button type="button" className="btn btn-soft btn-sm" style={{ marginTop: 12 }}
                  onClick={() => { const m = hours.find((h) => h.weekday === 1)!; setHours((hs) => hs.map((h) => (h.weekday >= 1 && h.weekday <= 5 ? { ...h, open: true, opens: m.opens, closes: m.closes } : h))); }}>
                  Copiar el lunes de lunes a viernes
                </button>
              </section>
            )}

            {step === 3 && (
              <section>
                <h1>Agrega tu primer producto</h1>
                <p className="sub">Después podrás subir el resto desde tu panel. Puedes omitir este paso.</p>
                <div className="form-grid">
                  <Field className="full" label="Nombre del producto" htmlFor="pname">
                    <input className="input" id="pname" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Ej: Pizza napolitana" />
                  </Field>
                  <Field label="Precio" htmlFor="pprice" error={errors.pPrice}>
                    <div className="input-group"><span>$</span>
                      <input id="pprice" inputMode="numeric" value={pPrice} onChange={(e) => setPPrice(e.target.value.replace(/\D/g, ""))} placeholder="9990" />
                    </div>
                  </Field>
                  <Field label="Categoría" htmlFor="pcat" hint="Opcional">
                    <input className="input" id="pcat" value={pCat} onChange={(e) => setPCat(e.target.value)} placeholder="Pizzas" />
                  </Field>
                </div>
              </section>
            )}

            <div className="onb-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)} style={{ visibility: step ? "visible" : "hidden" }}>
                <ArrowLeft /> Atrás
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                {step === 3 && <button type="button" className="btn btn-soft" disabled={busy} onClick={() => finish(true)}>Omitir</button>}
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? "Creando tu tienda…" : step === 3 ? "Crear mi tienda" : "Continuar"} {!busy && <ArrowRight />}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <aside className="onb-side" aria-label="Vista previa">
        <div className="onb-side-in">
          <span className="eyebrow">Vista previa en vivo</span>
          <div className="preview">
            <div className="pv-url">{BRAND.domain}/{slug || "tu-negocio"}</div>
            <div className="pv-cover" />
            <div className="pv-body">
              <div className="avatar pv-logo">{(name.trim()[0] ?? "T").toUpperCase()}</div>
              <h3>{name.trim() || "Tu negocio"}</h3>
              <div className="pv-pills">
                <span className="pill ok"><span className="dot" />Abierto</span>
                {type && <span className="pill">{BUSINESS_TYPES.find((b) => b.id === type)?.label}</span>}
                {delivery && <span className="pill"><Bike />Delivery {Number(fee) ? clp(Number(fee)) : "gratis"}</span>}
                {pickup && <span className="pill"><ShoppingBag />Retiro</span>}
              </div>
              {pName.trim() ? (
                <div className="pv-prod">
                  <div><b>{pName}</b><span className="muted">{pCat || "General"}</span><b className="num">{clp(Number(pPrice) || 0)}</b></div>
                  <div className="thumb"><Package /></div>
                </div>
              ) : (
                <div className="pv-empty">Tus productos aparecerán aquí</div>
              )}
              <div className="btn btn-primary btn-block" aria-hidden="true"><MessageCircle />Hacer pedido</div>
            </div>
          </div>
          <ul className="checklist">
            {[
              [name.trim().length > 1 && !!slug, "Nombre y enlace"],
              [!!type, "Tipo de negocio"],
              [!!wa, "WhatsApp para pedidos"],
              [openDays > 0, `Horario (${openDays} ${openDays === 1 ? "día" : "días"})`],
              [!!pName.trim(), "Primer producto"],
            ].map(([ok, t]) => (
              <li key={t as string} className={ok ? "ok" : ""}><span className="bx">{ok ? <Check /> : null}</span>{t}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
