export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** Nombre fijo de la cookie de sesión: igual en servidor y navegador aunque usen URLs distintas. */
export const AUTH_COOKIE = "sb-session";
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * URL que usa el navegador. Normalmente es la misma que la del servidor; si
 * NEXT_PUBLIC_SUPABASE_BROWSER_PATH está definida (ej. "/sb"), se usa el mismo origen de la app.
 */
export function browserSupabaseUrl() {
  const path = process.env.NEXT_PUBLIC_SUPABASE_BROWSER_PATH;
  if (path && typeof window !== "undefined") return window.location.origin + path;
  return SUPABASE_URL;
}
