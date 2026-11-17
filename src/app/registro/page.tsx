import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "../ingresar/auth-form";
import { AuthShell } from "../ingresar/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crear tienda" };

export default async function Page() {
  if (isSupabaseConfigured) {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/registro/tienda");
  }
  return (
    <AuthShell title="Crea tu tienda gratis" subtitle="Primero tu cuenta. Después configuramos tu tienda en 4 pasos.">
      <AuthForm mode="up" />
    </AuthShell>
  );
}
