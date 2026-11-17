import { Check } from "lucide-react";
import type { Metadata } from "next";
import { PLAN } from "@/config/brand";
import { clp } from "@/lib/format";
import { getStoreContext, trialDaysLeft } from "@/lib/store";

export const metadata: Metadata = { title: "Plan y pagos" };

const STATUS: Record<string, [string, string]> = {
  trialing: ["Prueba gratis", "accent"], active: ["Activo", "ok"], past_due: ["Pago pendiente", "warn"],
  paused: ["En pausa", "warn"], cancelled: ["Cancelado", "bad"],
};

export default async function Page() {
  const { subscription } = await getStoreContext();
  const days = trialDaysLeft(subscription);
  const [label, tone] = STATUS[subscription?.status ?? "trialing"];
  const ends = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-h"><div><h1>Plan y pagos</h1><p>Un solo plan, precio fijo, 0% de comisión por venta.</p></div></div>
      <section className="card" style={{ padding: 28, display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div><span className="eyebrow">{PLAN.name}</span><div className="price">{clp(PLAN.priceClp)}<small> / mes</small></div></div>
          <span className={`pill ${tone}`}><span className="dot" />{label}</span>
        </div>
        {days !== null && (
          <div className="alert ok">Te quedan {days} {days === 1 ? "día" : "días"} de prueba gratis (hasta el {ends}). No te cobraremos nada sin que actives tu suscripción.</div>
        )}
        <ul className="plan-list">
          {["Productos y pedidos ilimitados", "Tienda online y enlace propio", "Pedidos en tiempo real y a tu WhatsApp", "Horarios automáticos", "Sin comisión por venta", "Soporte por WhatsApp"].map((t) => (
            <li key={t}><Check />{t}</li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-lg" type="button" disabled>Activar suscripción con Mercado Pago</button>
          <span className="muted" style={{ fontSize: 13 }}>El cobro automático se habilita en la próxima versión. Mientras tanto tu prueba sigue activa.</span>
        </div>
      </section>
    </div>
  );
}
