import Link from "next/link";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="track" style={{ textAlign: "center", justifyItems: "center" }}>
      <Logo />
      <h1 style={{ marginTop: 24 }}>No encontramos esta página</h1>
      <p className="muted">Revisa el enlace o vuelve al inicio. Si buscabas una tienda, puede que haya cambiado de dirección.</p>
      <Link className="btn btn-primary" href="/">Ir al inicio</Link>
    </main>
  );
}
