import { BarChart3, Calculator, ChefHat, Layers, QrCode, Ticket, Trophy } from "lucide-react";
import { notFound } from "next/navigation";

const MODULES: Record<string, { title: string; text: string; icon: React.ComponentType<{ width?: number; height?: number }> }> = {
  caja: { title: "Caja POS", text: "Cobra ventas presenciales con el mismo catálogo y stock de tu tienda online.", icon: Calculator },
  cocina: { title: "Pantalla de cocina", text: "Comandas en vivo con temporizador y alerta cuando un pedido se atrasa.", icon: ChefHat },
  mesas: { title: "Mesas y QR", text: "Un QR por mesa: los pedidos llegan a cocina con el número de mesa.", icon: QrCode },
  inventario: { title: "Inventario", text: "Stock por producto, alertas de reposición e historial de movimientos.", icon: Layers },
  fidelidad: { title: "Fidelidad", text: "Tarjeta de sellos digital para que tus clientes vuelvan.", icon: Trophy },
  cupones: { title: "Cupones", text: "Descuentos por código con límite de usos y fecha de término.", icon: Ticket },
  reportes: { title: "Reportes", text: "Ventas por día, productos estrella y alertas que te dicen qué hacer.", icon: BarChart3 },
};

export default async function Page({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  const m = MODULES[modulo];
  if (!m) notFound();
  const Icon = m.icon;
  return (
    <div className="page">
      <section className="card" style={{ padding: 40, display: "grid", gap: 14, maxWidth: 640 }}>
        <span className="mod-ic"><Icon width={26} height={26} /></span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>{m.title}</h1>
        <p className="muted">{m.text}</p>
        <span className="pill accent" style={{ justifySelf: "start" }}>En desarrollo</span>
      </section>
    </div>
  );
}
