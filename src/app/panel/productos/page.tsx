import type { Metadata } from "next";
import { getStoreContext } from "@/lib/store";
import { supabaseServer } from "@/lib/supabase/server";
import type { Category, Product } from "@/lib/types";
import { Catalog } from "./catalog";

export const metadata: Metadata = { title: "Productos" };

export default async function Page({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const { nuevo } = await searchParams;
  const { store } = await getStoreContext();
  const supabase = await supabaseServer();
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("store_id", store.id).order("position").order("created_at"),
    supabase.from("categories").select("*").eq("store_id", store.id).order("position").order("name"),
  ]);
  return (
    <div className="page">
      <Catalog openNew={nuevo === "1"} storeId={store.id} products={(products ?? []) as Product[]} categories={(categories ?? []) as Category[]} />
    </div>
  );
}
