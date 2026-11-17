import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "Configura tu tienda" };

export default async function Page() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/registro");
  const { count } = await supabase.from("store_members").select("store_id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) > 0) redirect("/panel");
  const name = ((user.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0];
  return <Wizard ownerName={name} />;
}
