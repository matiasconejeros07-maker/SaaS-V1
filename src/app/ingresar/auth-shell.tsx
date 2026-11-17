import { Check } from "lucide-react";
import { Logo } from "@/components/ui";
import { SetupNotice } from "@/components/setup-notice";
import { PLAN } from "@/config/brand";
import { clp } from "@/lib/format";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <main className="auth-main">
        <Logo />
        <SetupNotice />
        <div className="auth-box">
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {children}
        </div>
      </main>
      <aside className="auth-side" aria-hidden="true">
        <div>
          <span className="eyebrow">0% de comisión por venta</span>
          <h2>Tu tienda online, tu carta QR y tus pedidos en un solo lugar.</h2>
          <ul>
            <li><Check /> {PLAN.trialDays} días gratis, sin tarjeta</li>
            <li><Check /> Luego {clp(PLAN.priceClp)} al mes, todo incluido</li>
            <li><Check /> Pedidos en tiempo real y en tu WhatsApp</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
