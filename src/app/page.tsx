import {
  ArrowRight, BarChart3, Bike, Calculator, CalendarClock, Check, ChefHat, Inbox, Layers, MessageCircle, QrCode, Store, Tag, Trophy,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { BRAND, PLAN } from "@/config/brand";
import { clp } from "@/lib/format";
import { SavingsCalculator } from "./savings";

const PILLARS = [
  { icon: Store, title: "Vende", text: "Tu catálogo online y tu carta QR, listos para compartir en Instagram, WhatsApp o la mesa.",
    items: ["Catálogo ilimitado con fotos", "Venta por unidad o por kilo", "Delivery y retiro con costo configurable", "Pedido mínimo y horarios automáticos"] },
  { icon: Inbox, title: "Opera", text: "Un tablero en vivo para pedidos. Nada se pierde entre chats.",
    items: ["Pedidos en tiempo real con aviso sonoro", "Alerta de pedidos atrasados", "Mesas con QR, pantalla de cocina y caja", "Apertura y cierre de caja con cuadratura"] },
  { icon: Trophy, title: "Crece", text: "Datos claros para decidir y herramientas para que tus clientes vuelvan.",
    items: ["Ventas del día y ticket promedio", "Seguimiento del pedido para tu cliente", "Fidelidad y cupones (próximamente)", "Reportes con alertas (próximamente)"] },
];

const STEPS = [
  ["Crea tu cuenta", "Nombre, WhatsApp y tipo de negocio. Tu enlace se genera solo.", "≈ 2 min"],
  ["Sube tus productos", "Con foto, precio y categoría, desde el computador o el celular.", "≈ 3 min"],
  ["Comparte tu enlace", "En tu bio de Instagram, grupos de WhatsApp o un QR en el mesón.", "1 clic"],
  ["Recibe pedidos", "Llegan a tu panel en tiempo real con nombre, detalle, dirección y pago.", "Al instante"],
];

const FAQ = [
  ["¿Mis clientes necesitan crear una cuenta?", "No. Solo escriben su nombre y celular al pedir. El navegador recuerda sus datos para la próxima vez."],
  ["¿Cómo me llegan los pedidos?", "Aparecen al instante en tu tablero de pedidos, con aviso sonoro si lo activas. Tu cliente también puede enviarte el resumen por WhatsApp."],
  ["¿Cobran un porcentaje de mis ventas?", `No. Pagas solo ${clp(PLAN.priceClp)} al mes. Lo que vendes es 100% tuyo.`],
  ["¿Qué pasa cuando termina la prueba?", `Tienes ${PLAN.trialDays} días gratis sin ingresar tarjeta. Si no activas tu plan, la tienda deja de recibir pedidos, pero no se borra nada.`],
  ["¿Puedo vender por kilo?", "Sí. Cada producto puede venderse por unidad o por kilo, con control de stock opcional."],
  ["¿Sirve para restaurantes con mesas?", "Sí. Imprimes un QR por mesa, tus clientes piden desde el celular y la comanda llega a la pantalla de cocina. Cobras la mesa desde la caja, con efectivo, tarjeta o transferencia."],
];

export default function Landing() {
  return (
    <div className="landing">
      <div className="wrap">
        <header className="site-nav">
          <Logo />
          <nav className="site-links" aria-label="Sitio">
            <a href="#producto">Producto</a><a href="#como-funciona">Cómo funciona</a><a href="#precio">Precio</a><a href="#preguntas">Preguntas</a>
          </nav>
          <span className="sp" />
          <Link className="btn btn-ghost btn-sm hide-sm" href="/ingresar">Ingresar</Link>
          <Link className="btn btn-primary btn-sm" href="/registro">Crear tienda</Link>
        </header>

        <section className="hero">
          <div>
            <span className="pill accent"><span className="dot" />0% de comisión por venta</span>
            <h1>Vende online con una tienda que <em>trabaja por ti</em>.</h1>
            <p className="lead">Catálogo online, carta QR y pedidos en tiempo real para pymes chilenas. Tus clientes compran sin crear cuenta y tú ves cada pedido al instante.</p>
            <div className="hero-cta">
              <Link className="btn btn-primary btn-lg" href="/registro">Crear mi tienda gratis <ArrowRight /></Link>
              <a className="btn btn-ghost btn-lg" href="#como-funciona">Ver cómo funciona</a>
            </div>
            <ul className="hero-meta">
              <li><Check />{PLAN.trialDays} días gratis</li><li><Check />Sin tarjeta de crédito</li><li><Check />Lista en 5 minutos</li>
            </ul>
          </div>
          <div className="stage" aria-hidden="true">
            <div className="stage-panel">
              <div className="sp-head"><i /><i /><i /><span>Pedidos · Krutz Pizzería</span></div>
              <div className="sp-body">
                {[["Nuevos", [["Valentina R.", "2× Napolitana", "Delivery", "$21.480"], ["Mesa 4", "Margarita · Bebida", "Mesa", "$12.400"]]],
                  ["Preparando", [["Tomás A.", "Pepperoni familiar", "Retiro", "$14.990"]]],
                  ["Listos", [["Josefa M.", "Calzone", "Retiro", "$9.990"]]]].map(([t, list]) => (
                  <div className="sp-col" key={t as string}>
                    <h5>{t as string}<span>{(list as string[][]).length}</span></h5>
                    {(list as string[][]).map(([w, i, f, p]) => (
                      <div className="sp-ticket" key={w}><b>{w}</b>{i}<div className="row"><span>{f}</span><span className="num">{p}</span></div></div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="phone">
              <div className="phone-in">
                <div className="ph-cover" />
                <div className="ph-store"><div className="ph-logo">K</div><div className="ph-name">Krutz Pizzería</div><span className="pill ok"><span className="dot" />Abierto · cierra 23:00</span></div>
                <div className="ph-chips"><span>Pizzas</span><span>Calzones</span><span>Bebidas</span></div>
                <div className="ph-item"><div className="th"><ChefHat /></div><div><b>Napolitana</b><span className="num">$9.990</span></div></div>
                <div className="ph-item"><div className="th"><ChefHat /></div><div><b>Margarita</b><span className="num">$8.990</span></div></div>
                <div className="ph-cart"><span>2 productos</span><span className="num">$18.980</span></div>
              </div>
            </div>
            <div className="toast-demo"><span className="ic"><MessageCircle /></span><div><b>Nuevo pedido #1049</b><br /><span className="muted">Valentina R. · Delivery · $21.480</span></div></div>
          </div>
        </section>
      </div>

      <div className="strip"><div className="wrap strip-in">
        <div><b>0%</b><span>comisión sobre tus ventas</span></div>
        <div><b>5 min</b><span>para publicar tu catálogo</span></div>
        <div><b>0</b><span>apps que tu cliente debe instalar</span></div>
        <div><b>1</b><span>plan, con todo incluido</span></div>
      </div></div>

      <div className="wrap">
        <section className="section" id="producto">
          <div className="section-head"><span className="eyebrow">Producto</span><h2>Todo lo que tu negocio necesita, en tres partes</h2><p>Activa solo los módulos que usas. El resto no aparece en tu panel.</p></div>
          <div className="pillars">
            {PILLARS.map(({ icon: Icon, title, text, items }) => (
              <article className="card pillar" key={title}>
                <span className="mod-ic"><Icon /></span>
                <h3>{title}</h3><p>{text}</p>
                <ul>{items.map((i) => <li key={i}><Check />{i}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="como-funciona">
          <div className="section-head"><span className="eyebrow">Cómo funciona</span><h2>De cero a tu primer pedido el mismo día</h2></div>
          <ol className="steps">
            {STEPS.map(([t, d, time], i) => (
              <li className="step" key={t}><span className="n">PASO {i + 1}</span><h3>{t}</h3><p>{d}</p><span className="t">{time}</span></li>
            ))}
          </ol>
        </section>

        <section className="section">
          <div className="section-head"><span className="eyebrow">Para cada rubro</span><h2>Pensado para cómo vendes tú</h2></div>
          <div className="rubros">
            {[[ChefHat, "Comida", "Pizzerías, cafés, restaurantes y panaderías", [[QrCode, "Carta QR por mesa"], [Bike, "Delivery y retiro"], [CalendarClock, "Horario automático"]]],
              [Tag, "Comercio", "Almacenes, botillerías, ropa y tecnología", [[Layers, "Stock por producto"], [Calculator, "Venta por kilo"], [Store, "Catálogo ilimitado"]]],
              [BarChart3, "Servicios", "Talleres, belleza y reparaciones", [[CalendarClock, "Reservas (próximamente)"], [MessageCircle, "Contacto directo"], [BarChart3, "Ventas del mes"]]]].map(([Icon, t, d, items]) => {
              const I = Icon as typeof Store;
              return (
                <article className="card rubro" key={t as string}>
                  <span className="mod-ic"><I /></span><h3>{t as string}</h3><p className="muted">{d as string}</p>
                  <ul>{(items as [typeof Store, string][]).map(([Ic, l]) => <li key={l}><Ic />{l}</li>)}</ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section" id="precio">
          <div className="section-head"><span className="eyebrow">Precio</span><h2>Un precio fijo. Cero comisión.</h2><p>Lo que vendes es tuyo. Compara con una app que cobra porcentaje por pedido.</p></div>
          <div className="pricing">
            <div className="card price-card dark">
              <div><h3>{PLAN.name}</h3><p className="muted">Todo incluido desde el día uno</p></div>
              <div className="price">{clp(PLAN.priceClp)}<small> / mes</small></div>
              <p className="muted">Primer mes gratis. Sin contrato. Precio en pesos chilenos.</p>
              <ul className="plan-list">
                {["Productos ilimitados", "Pedidos en tiempo real", "Tienda con enlace propio", "Venta por kilo y stock", "Horarios automáticos", "Soporte por WhatsApp"].map((t) => <li key={t}><Check />{t}</li>)}
              </ul>
              <Link className="btn btn-primary btn-lg" href="/registro">Empezar {PLAN.trialDays} días gratis</Link>
            </div>
            <SavingsCalculator plan={PLAN.priceClp} />
          </div>
        </section>

        <section className="section" id="preguntas">
          <div className="section-head"><span className="eyebrow">Preguntas frecuentes</span><h2>Respuestas directas</h2></div>
          <div className="faq">
            {FAQ.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>

        <div className="cta-band">
          <div><h2>Tu tienda puede estar recibiendo pedidos hoy.</h2><p>{PLAN.trialDays} días gratis. Sin tarjeta. Cancela cuando quieras.</p></div>
          <Link className="btn btn-primary btn-lg" href="/registro">Crear mi tienda <ArrowRight /></Link>
        </div>

        <footer className="footer">
          <span>© {new Date().getFullYear()} {BRAND.name}. Hecho en Chile.</span>
          <span>{BRAND.supportEmail}</span>
        </footer>
      </div>
    </div>
  );
}
