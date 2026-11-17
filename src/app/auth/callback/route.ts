import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Destino del enlace de confirmación de correo. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/panel";
  if (code) {
    const supabase = await supabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/panel";
  return NextResponse.redirect(new URL(dest, url.origin));
}
