"use client";
import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, useToast } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { DAYS, formatCLPhone, normalizeCLPhone } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BUSINESS_TYPES, type OpeningHour, type Store } from "@/lib/types";

type Hour = { weekday: number; open: boolean; opens: string; closes: string };
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const SECTIONS = [["negocio", "Negocio"], ["entrega", "Entrega y pagos"], ["horario", "Horario"], ["modulos", "Módulos"]] as const;

export function Settings({ store, hours: initialHours }: { store: Store; hours: OpeningHour[] }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState({
    name: store.name, phone: formatCLPhone(store.whatsapp).replace("+56 ", ""), business_type: store.business_type ?? "",
    description: store.description ?? "", address: store.address ?? "", commune: store.commune ?? "",
    pickup_enabled: store.pickup_enabled, delivery_enabled: store.delivery_enabled, delivery_fee: String(store.delivery_fee),
    min_order: String(store.min_order), accepts_cash: store.accepts_cash, accepts_transfer: store.accepts_transfer,
    transfer_details: store.transfer_details ?? "", is_published: store.is_published, modules: store.modules,
    logo_url: store.logo_url,
  });
  const [hours, setHours] = useState<Hour[]>(ORDER.map((d) => {
    const h = initialHours.find((x) => x.weekday === d);
    return { weekday: d, open: !!h, opens: h?.opens.slice(0, 5) ?? "09:00", closes: h?.closes.slice(0, 5) ?? "19:00" };
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const set = (p: Partial<typeof s>) => setS((x) => ({ ...x, ...p }));
  const setHour = (d: number, p: Partial<Hour>) => setHours((hs) => hs.map((h) => (h.weekday === d ? { ...h, ...p } : h)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const wa = normalizeCLPhone(s.phone);
    const er: Record<string, string> = {};
    if (s.name.trim().length < 2) er.name = "El nombre debe tener al menos 2 letras.";
    if (!wa) er.phone = "Ingresa un celular de 9 dígitos que empiece con 9.";
    if (!s.pickup_enabled && !s.delivery_enabled) er.delivery = "Activa retiro, delivery o ambos.";
    if (!s.accepts_cash && !s.accepts_transfer) er.pay = "Activa al menos un medio de pago.";
    if (hours.some((h) => h.open && h.opens >= h.closes)) er.hours = "La hora de cierre debe ser posterior a la de apertura.";
    if (logo && logo.size > 5 * 1024 * 1024) er.logo = "El logo debe pesar menos de 5 MB.";
    setErrors(er);
    if (Object.keys(er).length) { toast("Revisa los campos marcados"); return; }
    setBusy(true);

    let logoUrl = s.logo_url;
    if (logo) {
      const path = `${store.id}/logo-${crypto.randomUUID()}.${logo.name.split(".").pop() || "png"}`;
      const up = await supabase.storage.from("product-images").upload(path, logo, { contentType: logo.type });
      if (up.error) { setBusy(false); setErrors({ logo: "No se pudo subir el logo. Usa JPG, PNG o WEBP." }); return; }
      logoUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from("stores").update({
      name: s.name.trim(), whatsapp: wa, business_type: s.business_type || null, description: s.description.trim() || null,
      address: s.address.trim() || null, commune: s.commune.trim() || null, pickup_enabled: s.pickup_enabled,
      delivery_enabled: s.delivery_enabled, delivery_fee: Number(s.delivery_fee) || 0, min_order: Number(s.min_order) || 0,
      accepts_cash: s.accepts_cash, accepts_transfer: s.accepts_transfer, transfer_details: s.transfer_details.trim() || null,
      is_published: s.is_published, modules: s.modules, logo_url: logoUrl,
    }).eq("id", store.id);
    if (error) { setBusy(false); toast("No se pudieron guardar los cambios."); return; }

    const open = hours.filter((h) => h.open).map(({ weekday, opens, closes }) => ({ store_id: store.id, weekday, opens, closes }));
    const del = await supabase.from("opening_hours").delete().eq("store_id", store.id);
    const ins = open.length ? await supabase.from("opening_hours").insert(open) : { error: null };
    setBusy(false);
    if (del.error || ins.error) { toast("Se guardó la tienda, pero no el horario. Intenta de nuevo."); return; }
    set({ logo_url: logoUrl }); setLogo(null);
    toast("Cambios guardados");
    router.refresh();
  }

  return (
    <form className="settings" onSubmit={save} noValidate>
      <nav className="settings-nav" aria-label="Secciones">
        {SECTIONS.map(([id, l]) => <a key={id} href={`#${id}`}>{l}</a>)}
      </nav>
      <div className="settings-body">
        <section className="card settings-sec" id="negocio">
          <h2>Negocio</h2>
          <div className="img-pick">
            <div className="avatar" style={{ width: 72, height: 72, borderRadius: 18, fontSize: 28 }}>
              {logo ? <img src={URL.createObjectURL(logo)} alt="" /> : s.logo_url ? <img src={s.logo_url} alt="" /> : <ImagePlus />}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label className="btn btn-soft btn-sm" style={{ justifySelf: "start" }}>Subir logo
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
              </label>
              <span className={errors.logo ? "err" : "hint"}>{errors.logo ?? "Cuadrado, idealmente 512×512 px."}</span>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Nombre de la tienda" htmlFor="s-name" error={errors.name}>
              <input className="input" id="s-name" value={s.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Enlace" htmlFor="s-slug" hint="Para cambiar el enlace escríbenos a soporte.">
              <input className="input" id="s-slug" value={`${BRAND.domain}/${store.slug}`} readOnly />
            </Field>
            <Field label="WhatsApp para pedidos" htmlFor="s-phone" error={errors.phone}>
              <div className="input-group"><span>+56</span><input id="s-phone" inputMode="tel" value={s.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
            </Field>
            <Field label="Tipo de negocio" htmlFor="s-type">
              <select className="select" id="s-type" value={s.business_type} onChange={(e) => set({ business_type: e.target.value })}>
                <option value="">Sin especificar</option>
                {BUSINESS_TYPES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </Field>
            <Field className="full" label="Descripción" htmlFor="s-desc" hint="Aparece bajo el nombre en tu tienda. Hasta 500 caracteres.">
              <textarea className="textarea" id="s-desc" maxLength={500} value={s.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="Dirección del local" htmlFor="s-addr">
              <input className="input" id="s-addr" value={s.address} onChange={(e) => set({ address: e.target.value })} placeholder="Calle y número" />
            </Field>
            <Field label="Comuna" htmlFor="s-commune">
              <input className="input" id="s-commune" value={s.commune} onChange={(e) => set({ commune: e.target.value })} placeholder="Ej: San Bernardo" />
            </Field>
          </div>
          <label className="toggle-row"><span><b>Tienda publicada</b><small>Si la apagas, nadie puede ver tu tienda ni hacer pedidos</small></span>
            <span className="switch"><input type="checkbox" checked={s.is_published} onChange={(e) => set({ is_published: e.target.checked })} /><span /></span></label>
        </section>

        <section className="card settings-sec" id="entrega">
          <h2>Entrega y pagos</h2>
          <label className="toggle-row"><span><b>Retiro en el local</b></span>
            <span className="switch"><input type="checkbox" checked={s.pickup_enabled} onChange={(e) => set({ pickup_enabled: e.target.checked })} /><span /></span></label>
          <label className="toggle-row"><span><b>Delivery</b></span>
            <span className="switch"><input type="checkbox" checked={s.delivery_enabled} onChange={(e) => set({ delivery_enabled: e.target.checked })} /><span /></span></label>
          {errors.delivery && <span className="err">{errors.delivery}</span>}
          <div className="form-grid">
            {s.delivery_enabled && (
              <Field label="Costo del delivery" htmlFor="s-fee" hint="Usa 0 para delivery gratis.">
                <div className="input-group"><span>$</span><input id="s-fee" inputMode="numeric" value={s.delivery_fee} onChange={(e) => set({ delivery_fee: e.target.value.replace(/\D/g, "") })} /></div>
              </Field>
            )}
            <Field label="Pedido mínimo" htmlFor="s-min" hint="Usa 0 para no exigir mínimo.">
              <div className="input-group"><span>$</span><input id="s-min" inputMode="numeric" value={s.min_order} onChange={(e) => set({ min_order: e.target.value.replace(/\D/g, "") })} /></div>
            </Field>
          </div>
          <span className="label">Medios de pago</span>
          <label className="toggle-row"><span><b>Efectivo</b></span>
            <span className="switch"><input type="checkbox" checked={s.accepts_cash} onChange={(e) => set({ accepts_cash: e.target.checked })} /><span /></span></label>
          <label className="toggle-row"><span><b>Transferencia</b></span>
            <span className="switch"><input type="checkbox" checked={s.accepts_transfer} onChange={(e) => set({ accepts_transfer: e.target.checked })} /><span /></span></label>
          {s.accepts_transfer && (
            <Field label="Datos para transferir" htmlFor="s-transfer" hint="Se muestran al cliente después de confirmar el pedido.">
              <textarea className="textarea" id="s-transfer" value={s.transfer_details} maxLength={500} onChange={(e) => set({ transfer_details: e.target.value })}
                placeholder={"Banco, tipo de cuenta, número, RUT y correo"} />
            </Field>
          )}
          <div className="toggle-row" style={{ opacity: .7 }}><span><b>Mercado Pago</b><small>Cobro en línea con tarjeta. Disponible en la próxima versión.</small></span><span className="pill">Pronto</span></div>
          {errors.pay && <span className="err">{errors.pay}</span>}
        </section>

        <section className="card settings-sec" id="horario">
          <h2>Horario de atención</h2>
          <p className="muted" style={{ fontSize: 14 }}>Hora de Chile continental. Fuera de este horario la tienda muestra &quot;Cerrado&quot; y no acepta pedidos.</p>
          <div className="hours">
            {hours.map((h) => (
              <div className="hour-row" key={h.weekday}>
                <b>{DAYS[h.weekday]}</b>
                <span className="switch"><input type="checkbox" aria-label={`Abre el ${DAYS[h.weekday]}`} checked={h.open} onChange={(e) => setHour(h.weekday, { open: e.target.checked })} /><span /></span>
                <span className="times">{h.open ? (<>
                  <input type="time" aria-label={`Apertura ${DAYS[h.weekday]}`} value={h.opens} onChange={(e) => setHour(h.weekday, { opens: e.target.value })} /> a
                  <input type="time" aria-label={`Cierre ${DAYS[h.weekday]}`} value={h.closes} onChange={(e) => setHour(h.weekday, { closes: e.target.value })} />
                </>) : "Cerrado"}</span>
              </div>
            ))}
          </div>
          {errors.hours && <span className="err">{errors.hours}</span>}
        </section>

        <section className="card settings-sec" id="modulos">
          <h2>Módulos</h2>
          <p className="muted" style={{ fontSize: 14 }}>Activa solo lo que usas. Los módulos inactivos no aparecen en tu tienda.</p>
          {([["tables", "Mesas con QR", "Carta digital por mesa"], ["kitchen", "Pantalla de cocina", "Comandas en vivo para la cocina"],
            ["pos", "Caja POS", "Ventas presenciales"], ["inventory", "Inventario", "Stock y alertas de reposición"]] as const).map(([k, t, d]) => (
            <label className="toggle-row" key={k}><span><b>{t}</b><small>{d}{k === "inventory" ? " · en desarrollo" : ""}</small></span>
              <span className="switch"><input type="checkbox" checked={!!s.modules?.[k]} onChange={(e) => set({ modules: { ...s.modules, [k]: e.target.checked } })} /><span /></span></label>
          ))}
        </section>

        <div className="settings-save">
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </div>
    </form>
  );
}
