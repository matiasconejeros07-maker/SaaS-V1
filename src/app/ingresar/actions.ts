"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string; email?: string };

const msg = (m: string) =>
  /invalid login/i.test(m) ? "El correo o la contraseña no coinciden."
  : /email not confirmed/i.test(m) ? "Confirma tu correo: te enviamos un enlace al registrarte."
  : /already registered/i.test(m) ? "Ya existe una cuenta con ese correo. Ingresa con tu contraseña."
  : /password/i.test(m) ? "La contraseña debe tener al menos 8 caracteres."
  : "No pudimos completar la acción. Inténtalo de nuevo en un momento.";

const safeNext = (n: FormDataEntryValue | null) => {
  const v = typeof n === "string" ? n : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/panel";
};

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Ingresa tu correo y tu contraseña.", email };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: msg(error.message), email };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!name) return { error: "Escribe tu nombre.", email };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Revisa el formato del correo.", email };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres.", email };
  const supabase = await supabaseServer();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: name }, emailRedirectTo: `${site}/auth/callback?next=/registro/tienda` },
  });
  if (error) return { error: msg(error.message), email };
  if (!data.session) return { info: `Te enviamos un correo a ${email}. Ábrelo para confirmar tu cuenta y seguir.`, email };
  redirect("/registro/tienda");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
