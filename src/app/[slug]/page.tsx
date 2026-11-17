import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { openState } from "@/lib/hours";
import { supabaseServer } from "@/lib/supabase/server";
import type { Category, OpeningHour, Product, Store } from "@/lib/types";
import { Shop } from "./shop";

const load = cache(async (slug: string) => {
  const supabase = await supabaseServer();
  const { data: store } = await supabase.from("stores").select("*").eq("slug", slug.toLowerCase()).eq("is_published", true).maybeSingle();
  if (!store) return null;
  const [{ data: categories }, { data: products }, { data: hours }] = await Promise.all([
    supabase.from("categories").select("*").eq("store_id", store.id).order("position").order("name"),
    supabase.from("products").select("*").eq("store_id", store.id).order("position").order("created_at"),
    supabase.from("opening_hours").select("*").eq("store_id", store.id),
  ]);
  return { store: store as Store, categories: (categories ?? []) as Category[], products: (products ?? []) as Product[], hours: (hours ?? []) as OpeningHour[] };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Tienda no encontrada" };
  return {
    title: { absolute: data.store.name },
    description: data.store.description ?? `Haz tu pedido online en ${data.store.name}.`,
    openGraph: { title: data.store.name, description: data.store.description ?? undefined, images: data.store.logo_url ? [data.store.logo_url] : undefined },
  };
}

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mesa?: string }> }) {
  const { slug } = await params;
  const { mesa } = await searchParams;
  const data = await load(slug);
  if (!data) notFound();
  const state = openState(data.hours, data.store.timezone);
  const products = data.products.filter((p) => (mesa ? true : !p.dine_in_only));
  return <Shop store={data.store} categories={data.categories} products={products} hours={data.hours} open={state} tableToken={mesa ?? null} />;
}
