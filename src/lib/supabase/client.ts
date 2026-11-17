"use client";
import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE, SUPABASE_ANON_KEY, browserSupabaseUrl } from "./env";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function supabaseBrowser() {
  client ??= createBrowserClient(browserSupabaseUrl(), SUPABASE_ANON_KEY, { cookieOptions: { name: AUTH_COOKIE } });
  return client;
}
