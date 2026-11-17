"use client";
import { ImagePlus, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Thumb } from "@/components/thumb";
import { Drawer, Field, useToast } from "@/components/ui";
import { clp } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Category, Product } from "@/lib/types";

type Draft = {
  id?: string; name: string; description: string; price: string; unit: "unit" | "kg"; category_id: string;
  newCategory: string; is_available: boolean; dine_in_only: boolean; track_stock: boolean; stock: string; image_url: string | null; barcode: string;
};
const empty = (cat = ""): Draft => ({
  name: "", description: "", price: "", unit: "unit", category_id: cat, newCategory: "",
  is_available: true, dine_in_only: false, track_stock: false, stock: "0", image_url: null, barcode: "",
});

export function Catalog({ storeId, products: initialProducts, categories: initialCats, openNew = false }: { storeId: string; products: Product[]; categories: Category[]; openNew?: boolean }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const toast = useToast();
  const [products, setProducts] = useState(initialProducts);
  const [cats, setCats] = useState(initialCats);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const list = useMemo(() => products.filter((p) =>
    (cat === "all" || (cat === "none" ? !p.category_id : p.category_id === cat)) &&
    p.name.toLowerCase().includes(q.trim().toLowerCase())), [products, cat, q]);
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "Sin categoría";

  function edit(p?: Product) {
    setErrors({}); setConfirmDelete(false); setFile(null);
    setDraft(p ? {
      id: p.id, name: p.name, description: p.description ?? "", price: String(p.price), unit: p.unit, category_id: p.category_id ?? "",
      newCategory: "", is_available: p.is_available, dine_in_only: p.dine_in_only, track_stock: p.track_stock, stock: String(p.stock), image_url: p.image_url, barcode: p.barcode ?? "",
    } : empty(cat !== "all" && cat !== "none" ? cat : cats[0]?.id ?? ""));
  }

  async function toggle(p: Product) {
    setProducts((l) => l.map((x) => (x.id === p.id ? { ...x, is_available: !p.is_available } : x)));
    const { error } = await supabase.from("products").update({ is_available: !p.is_available }).eq("id", p.id);
    if (error) { toast("No se pudo guardar. Intenta de nuevo."); setProducts((l) => l.map((x) => (x.id === p.id ? p : x))); return; }
    toast(`${p.name}: ${!p.is_available ? "disponible" : "agotado"}`);
  }

  async function save() {
    if (!draft) return;
    const e: Record<string, string> = {};
    const price = Number(draft.price);
    if (!draft.name.trim()) e.name = "Escribe el nombre del producto.";
    if (!(price >= 0) || draft.price === "") e.price = "Ingresa el precio en pesos, sin puntos.";
    if (draft.category_id === "__new" && !draft.newCategory.trim()) e.newCategory = "Escribe el nombre de la categoría.";
    if (file && file.size > 5 * 1024 * 1024) e.image = "La imagen debe pesar menos de 5 MB.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);

    let categoryId: string | null = draft.category_id || null;
    if (draft.category_id === "__new") {
      const { data, error } = await supabase.from("categories")
        .insert({ store_id: storeId, name: draft.newCategory.trim(), position: cats.length }).select().single();
      if (error) { setBusy(false); setErrors({ newCategory: /duplicate|unique/i.test(error.message) ? "Ya tienes una categoría con ese nombre." : "No se pudo crear la categoría." }); return; }
      setCats((c) => [...c, data as Category]);
      categoryId = data.id;
    }

    let imageUrl = draft.image_url;
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${storeId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
      if (error) { setBusy(false); setErrors({ image: "No se pudo subir la imagen. Usa JPG, PNG o WEBP." }); return; }
      imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    }

    const row = {
      store_id: storeId, name: draft.name.trim(), description: draft.description.trim() || null, price, unit: draft.unit,
      category_id: categoryId, is_available: draft.is_available, dine_in_only: draft.dine_in_only,
      track_stock: draft.track_stock, stock: Number(draft.stock.replace(",", ".")) || 0, image_url: imageUrl,
      barcode: draft.barcode.trim() || null,
    };
    const res = draft.id
      ? await supabase.from("products").update(row).eq("id", draft.id).select().single()
      : await supabase.from("products").insert({ ...row, position: products.length }).select().single();
    setBusy(false);
    if (res.error) { toast(/barcode/i.test(res.error.message) ? "Ese código de barras ya está en otro producto." : "No se pudo guardar el producto."); return; }
    const saved = res.data as Product;
    setProducts((l) => (draft.id ? l.map((x) => (x.id === saved.id ? saved : x)) : [...l, saved]));
    setDraft(null);
    toast(draft.id ? "Producto actualizado" : "Producto creado");
    router.refresh();
  }

  async function remove() {
    if (!draft?.id) return;
    setBusy(true);
    const { error } = await supabase.from("products").delete().eq("id", draft.id);
    setBusy(false);
    if (error) { toast("No se pudo eliminar."); return; }
    setProducts((l) => l.filter((x) => x.id !== draft.id));
    setDraft(null);
    toast("Producto eliminado");
  }

  useEffect(() => {
    if (openNew) { edit(); window.history.replaceState(null, "", "/panel/productos"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNew]);

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const [filePreview, setFilePreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setFilePreview(null); return; }
    const u = URL.createObjectURL(file); setFilePreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const preview = filePreview ?? draft?.image_url;

  return (
    <>
      <div className="page-h">
        <div><h1>Productos</h1><p>{products.length} {products.length === 1 ? "producto" : "productos"} en tu catálogo</p></div>
        <button className="btn btn-primary" type="button" onClick={() => edit()}><Plus />Nuevo producto</button>
      </div>

      <div className="p-toolbar">
        <div className="search"><Search /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" /></div>
        <div className="seg" role="group" aria-label="Categoría">
          <button type="button" aria-pressed={cat === "all"} onClick={() => setCat("all")}>Todas</button>
          {cats.map((c) => <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</button>)}
          {products.some((p) => !p.category_id) && <button type="button" aria-pressed={cat === "none"} onClick={() => setCat("none")}>Sin categoría</button>}
        </div>
      </div>

      <section className="card">
        {list.length ? (
          <div className="tscroll">
            <table className="table">
              <thead><tr><th>Producto</th><th>Categoría</th><th className="r">Precio</th><th className="r">Stock</th><th>Disponible</th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="row-link" onClick={() => edit(p)}>
                    <td>
                      <div className="p-name">
                        <Thumb name={p.name} src={p.image_url} />
                        <div><b>{p.name}</b><span>{p.description || "Sin descripción"}</span></div>
                      </div>
                    </td>
                    <td>{catName(p.category_id)}</td>
                    <td className="r mono">{clp(p.price)}{p.unit === "kg" ? " /kg" : ""}</td>
                    <td className="r mono">{p.track_stock ? `${p.stock}${p.unit === "kg" ? " kg" : ""}` : "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <label className="switch"><input type="checkbox" checked={p.is_available} onChange={() => toggle(p)} aria-label={`Disponible: ${p.name}`} /><span /></label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            {products.length ? `No hay productos que coincidan con "${q}".` : "Tu catálogo está vacío. Agrega tu primer producto para empezar a vender."}
            {!products.length && <button className="btn btn-primary btn-sm" type="button" onClick={() => edit()}><Plus />Agregar producto</button>}
          </div>
        )}
      </section>

      <Drawer open={!!draft} title={draft?.id ? "Editar producto" : "Nuevo producto"} onClose={() => setDraft(null)}
        footer={confirmDelete ? (
          <>
            <span className="muted" style={{ marginRight: "auto", fontSize: 13 }}>¿Eliminar este producto?</span>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirmDelete(false)}>No</button>
            <button className="btn btn-danger" type="button" disabled={busy} onClick={remove}>Sí, eliminar</button>
          </>
        ) : (
          <>
            {draft?.id && <button className="btn btn-ghost btn-icon" type="button" aria-label="Eliminar producto" style={{ marginRight: "auto" }} onClick={() => setConfirmDelete(true)}><Trash2 /></button>}
            <button className="btn btn-ghost" type="button" onClick={() => setDraft(null)}>Cancelar</button>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={save}>{busy ? "Guardando…" : draft?.id ? "Guardar cambios" : "Crear producto"}</button>
          </>
        )}>
        {draft && (
          <>
            <div className="img-pick">
              <div className="thumb" style={{ width: 88, height: 88, borderRadius: 14 }}>{preview ? <img src={preview} alt="" /> : <ImagePlus />}</div>
              <div style={{ display: "grid", gap: 6 }}>
                <label className="btn btn-soft btn-sm" style={{ justifySelf: "start" }}>
                  {preview ? "Cambiar foto" : "Subir foto"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <span className={errors.image ? "err" : "hint"}>{errors.image ?? "Foto cuadrada, JPG, PNG o WEBP de hasta 5 MB."}</span>
              </div>
            </div>
            <Field label="Nombre" htmlFor="p-name" error={errors.name}>
              <input className="input" id="p-name" value={draft.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} placeholder="Ej: Pizza napolitana" />
            </Field>
            <Field label="Descripción" htmlFor="p-desc" hint="Opcional. Ingredientes, tamaño o lo que lo hace especial.">
              <textarea className="textarea" id="p-desc" value={draft.description} maxLength={500} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label={draft.unit === "kg" ? "Precio por kilo" : "Precio"} htmlFor="p-price" error={errors.price}>
                <div className="input-group"><span>$</span><input id="p-price" inputMode="numeric" value={draft.price} onChange={(e) => set({ price: e.target.value.replace(/\D/g, "") })} placeholder="9990" /></div>
              </Field>
              <Field label="Se vende por" htmlFor="p-unit">
                <select className="select" id="p-unit" value={draft.unit} onChange={(e) => set({ unit: e.target.value as "unit" | "kg" })}>
                  <option value="unit">Unidad</option><option value="kg">Kilo</option>
                </select>
              </Field>
              <Field className="full" label="Categoría" htmlFor="p-cat">
                <select className="select" id="p-cat" value={draft.category_id} onChange={(e) => set({ category_id: e.target.value })}>
                  <option value="">Sin categoría</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new">+ Nueva categoría…</option>
                </select>
              </Field>
              {draft.category_id === "__new" && (
                <Field className="full" label="Nombre de la nueva categoría" htmlFor="p-newcat" error={errors.newCategory}>
                  <input className="input" id="p-newcat" value={draft.newCategory} onChange={(e) => set({ newCategory: e.target.value })} placeholder="Ej: Pizzas" />
                </Field>
              )}
            </div>
            <label className="toggle-row"><span><b>Disponible</b><small>Si lo apagas, se muestra como agotado</small></span>
              <span className="switch"><input type="checkbox" checked={draft.is_available} onChange={(e) => set({ is_available: e.target.checked })} /><span /></span></label>
            <label className="toggle-row"><span><b>Controlar stock</b><small>Se descuenta con cada venta y se agota al llegar a 0</small></span>
              <span className="switch"><input type="checkbox" checked={draft.track_stock} onChange={(e) => set({ track_stock: e.target.checked })} /><span /></span></label>
            {draft.track_stock && (
              <Field label={draft.unit === "kg" ? "Stock en kilos" : "Unidades en stock"} htmlFor="p-stock">
                <input className="input" id="p-stock" inputMode="decimal" value={draft.stock} onChange={(e) => set({ stock: e.target.value.replace(/[^\d.,]/g, "") })} />
              </Field>
            )}
            <Field label="Código de barras" htmlFor="p-barcode" hint="Opcional. Con el lector, haz clic aquí y escanea el producto.">
              <input className="input" id="p-barcode" value={draft.barcode} onChange={(e) => set({ barcode: e.target.value.trim() })} />
            </Field>
            <label className="toggle-row"><span><b>Solo para consumir en el local</b><small>Aparece en la carta de mesas, no en la tienda online</small></span>
              <span className="switch"><input type="checkbox" checked={draft.dine_in_only} onChange={(e) => set({ dine_in_only: e.target.checked })} /><span /></span></label>
          </>
        )}
      </Drawer>
    </>
  );
}
