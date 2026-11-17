import type { Metadata } from "next";
import { AuthForm } from "./auth-form";
import { AuthShell } from "./auth-shell";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Ingresa a tu panel" subtitle="Gestiona tus pedidos, productos y tienda.">
      <AuthForm mode="in" next={next} />
    </AuthShell>
  );
}
