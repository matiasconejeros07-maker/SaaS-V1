"use client";
import {
  BarChart3, Calculator, ChefHat, CreditCard, ExternalLink, Home, Inbox, Package, Plus, Printer, QrCode, Search, Settings, Sparkles,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Cmd = { id: string; label: string; group: "Ir a" | "Acciones"; icon: React.ComponentType; href: string; external?: boolean; keywords?: string };

const TITLES: [string, string][] = [
  ["/panel/pedidos", "Pedidos"], ["/panel/productos", "Productos"], ["/panel/caja", "Caja"], ["/panel/mesas", "Mesas"],
  ["/panel/configuracion", "Configuración"], ["/panel/plan", "Plan y pagos"], ["/panel/reportes", "Reportes"],
  ["/panel/fidelidad", "Fidelidad"], ["/panel/cupones", "Cupones"], ["/panel/inventario", "Inventario"], ["/panel", "Inicio"],
];

export function Topbar({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const title = TITLES.find(([p]) => path === p || path.startsWith(p + "/"))?.[1] ?? "Panel";

  const cmds: Cmd[] = useMemo(() => [
    { id: "home", label: "Inicio", group: "Ir a", icon: Home, href: "/panel", keywords: "dashboard resumen" },
    { id: "orders", label: "Pedidos", group: "Ir a", icon: Inbox, href: "/panel/pedidos", keywords: "tablero ordenes" },
    { id: "pos", label: "Caja", group: "Ir a", icon: Calculator, href: "/panel/caja", keywords: "pos vender cobrar" },
    { id: "kitchen", label: "Cocina", group: "Ir a", icon: ChefHat, href: "/cocina", keywords: "kds comandas" },
    { id: "tables", label: "Mesas", group: "Ir a", icon: QrCode, href: "/panel/mesas", keywords: "qr salon" },
    { id: "products", label: "Productos", group: "Ir a", icon: Package, href: "/panel/productos", keywords: "catalogo carta menu" },
    { id: "reports", label: "Reportes", group: "Ir a", icon: BarChart3, href: "/panel/reportes" },
    { id: "settings", label: "Configuración", group: "Ir a", icon: Settings, href: "/panel/configuracion", keywords: "horario logo whatsapp delivery" },
    { id: "plan", label: "Plan y pagos", group: "Ir a", icon: CreditCard, href: "/panel/plan", keywords: "suscripcion" },
    { id: "new-product", label: "Nuevo producto", group: "Acciones", icon: Plus, href: "/panel/productos?nuevo=1", keywords: "agregar crear" },
    { id: "store", label: `Ver ${storeName}`, group: "Acciones", icon: ExternalLink, href: `/${storeSlug}`, external: true, keywords: "tienda publica" },
    { id: "print", label: "Imprimir QR de mesas", group: "Acciones", icon: Printer, href: "/panel/mesas/imprimir", external: true },
    { id: "help", label: "Preguntar al asistente", group: "Acciones", icon: Sparkles, href: "#asistente", keywords: "ayuda chat duda soporte ia" },
  ], [storeSlug, storeName]);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = cmds.filter((c) => !q.trim() || norm(`${c.label} ${c.keywords ?? ""}`).includes(norm(q.trim())));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "/" && !open && !(e.target as HTMLElement).closest("input,textarea,select,[contenteditable]")) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => input.current?.focus(), 10); } }, [open]);
  useEffect(() => setSel(0), [q]);

  function run(c: Cmd) {
    setOpen(false);
    if (c.href === "#asistente") { window.dispatchEvent(new Event("asistente:toggle")); return; }
    if (c.external) window.open(c.href, "_blank", "noopener");
    else router.push(c.href);
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">{title}</div>
        <span className="sp" />
        <button type="button" className="cmd-trigger" onClick={() => setOpen(true)} aria-label="Buscar o ir a">
          <Search /><span>Buscar o ir a…</span><kbd>⌘K</kbd>
        </button>
        <button type="button" className="btn btn-ghost btn-sm ai-trigger" onClick={() => window.dispatchEvent(new Event("asistente:toggle"))}><Sparkles />Ayuda</button>
        <a className="btn btn-ghost btn-sm" href={`/${storeSlug}`} target="_blank" rel="noopener"><ExternalLink /><span className="hide-sm">Ver mi tienda</span></a>
      </div>
      {open && (
        <div className="cmd-scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="cmd" role="dialog" aria-modal="true" aria-label="Paleta de comandos"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, list.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              else if (e.key === "Enter" && list[sel]) { e.preventDefault(); run(list[sel]); }
            }}>
            <div className="cmd-input"><Search />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe una sección o acción…" aria-label="Buscar" />
            </div>
            <ul className="cmd-list" role="listbox">
              {list.length === 0 && <li className="cmd-empty">Sin resultados para “{q}”.</li>}
              {list.map((c, i) => {
                const Icon = c.icon;
                const header = i === 0 || list[i - 1].group !== c.group;
                return (
                  <li key={c.id} role="presentation">
                    {header && <div className="cmd-group">{c.group}</div>}
                    <div className="cmd-item" role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
                      <Icon />{c.label}{c.external && <small>Nueva pestaña</small>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="cmd-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> moverse</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span></div>
          </div>
        </div>
      )}
    </>
  );
}
