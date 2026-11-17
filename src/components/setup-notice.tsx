import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Aviso para desarrollo cuando faltan las variables de Supabase. */
export function SetupNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="alert warn" style={{ margin: 16 }}>
      Falta conectar Supabase. Copia <code>.env.example</code> a <code>.env.local</code> y completa
      NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver README).
    </div>
  );
}
