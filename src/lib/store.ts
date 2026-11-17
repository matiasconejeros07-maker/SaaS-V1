import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { MemberRole, Store, Subscription } from "@/lib/types";

export type StoreContext = {
  userId: string;
  userName: string;
  role: MemberRole;
  store: Store;
  subscription: Subscription | null;
};

/** Tienda activa del usuario (la primera donde es miembro). Redirige si no hay sesión o tienda. */
export const getStoreContext = cache(async (): Promise<StoreContext> => {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: member } = await supabase
    .from("store_members")
    .select("role, stores(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const store = (member as { stores: Store | null } | null)?.stores;
  if (!member || !store) redirect("/registro/tienda");

  const { data: subscription } = await supabase.from("subscriptions").select("*").eq("store_id", store.id).maybeSingle();
  const full = (user.user_metadata?.full_name as string | undefined) ?? "";
  return {
    userId: user.id,
    userName: full.split(" ")[0] || "",
    role: member.role as MemberRole,
    store,
    subscription: subscription as Subscription | null,
  };
});

export function trialDaysLeft(sub: Subscription | null) {
  if (!sub || sub.status !== "trialing") return null;
  return Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000));
}
