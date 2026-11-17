"use client";
import {
  BarChart3, Calculator, ChefHat, CreditCard, Home, Inbox, Layers, Package, QrCode, Settings, Ticket, Trophy,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Store } from "@/lib/types";

type Item = { href: string; label: string; icon: React.ComponentType; module?: keyof Store["modules"]; soon?: boolean };
const GROUPS: { title?: string; items: Item[] }[] = [
  { items: [{ href: "/panel", label: "Inicio", icon: Home }] },
  { title: "Ventas", items: [
    { href: "/panel/pedidos", label: "Pedidos", icon: Inbox },
    { href: "/panel/caja", label: "Caja POS", icon: Calculator, module: "pos", soon: true },
    { href: "/panel/cocina", label: "Cocina", icon: ChefHat, module: "kitchen", soon: true },
    { href: "/panel/mesas", label: "Mesas y QR", icon: QrCode, module: "tables", soon: true },
  ] },
  { title: "Catálogo", items: [
    { href: "/panel/productos", label: "Productos", icon: Package },
    { href: "/panel/inventario", label: "Inventario", icon: Layers, module: "inventory", soon: true },
  ] },
  { title: "Clientes", items: [
    { href: "/panel/fidelidad", label: "Fidelidad", icon: Trophy, soon: true },
    { href: "/panel/cupones", label: "Cupones", icon: Ticket, soon: true },
  ] },
  { title: "Negocio", items: [
    { href: "/panel/reportes", label: "Reportes", icon: BarChart3, soon: true },
    { href: "/panel/configuracion", label: "Configuración", icon: Settings },
    { href: "/panel/plan", label: "Plan y pagos", icon: CreditCard },
  ] },
];

export function PanelNav({ store, activeOrders }: { store: Store; activeOrders: number }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/panel" ? path === "/panel" : path.startsWith(href));
  return (
    <nav aria-label="Panel">
      {GROUPS.map((g, i) => (
        <div className="nav-group" key={i}>
          {g.title && <span>{g.title}</span>}
          {g.items.map((it) => {
            const Icon = it.icon;
            const off = it.module ? !store.modules?.[it.module] : false;
            return (
              <Link key={it.href} href={it.href} className="nav-item" aria-current={isActive(it.href) ? "page" : undefined}>
                <Icon />
                {it.label}
                {it.href === "/panel/pedidos" && activeOrders > 0 && <span className="count">{activeOrders}</span>}
                {it.soon ? <span className="off">Pronto</span> : off ? <span className="off">Inactivo</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  const items = [["/panel", "Inicio"], ["/panel/pedidos", "Pedidos"], ["/panel/productos", "Productos"], ["/panel/configuracion", "Tienda"], ["/panel/plan", "Plan"]];
  return (
    <nav className="mobile-nav" aria-label="Panel">
      {items.map(([h, l]) => {
        const on = h === "/panel" ? path === "/panel" : path.startsWith(h);
        return <Link key={h} href={h} className={`btn btn-sm ${on ? "btn-primary" : "btn-soft"}`}>{l}</Link>;
      })}
    </nav>
  );
}
