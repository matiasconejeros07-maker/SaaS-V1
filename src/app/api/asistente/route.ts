import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { INSTRUCTIONS, KNOWLEDGE } from "@/lib/assistant/knowledge";
import { supabaseServer } from "@/lib/supabase/server";
import type { Store, Subscription } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ASSISTANT_MODEL ?? "claude-haiku-5-5";
const DAILY_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT ?? 60);

const Body = z.object({
  path: z.string().max(200).default("/panel"),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4000),
  })).min(1).max(40),
});

const text = (msg: string, status = 200) => new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

let client: Anthropic | null = null;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return text("El asistente todavía no está configurado en este servidor. Falta la clave de la API de Anthropic.", 503);
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return text("No pude leer tu mensaje. Intenta de nuevo.", 400);
  // Solo los últimos 20 turnos; debe empezar con un mensaje del usuario y terminar en uno.
  let messages = parsed.data.messages.slice(-20);
  while (messages.length && messages[0].role !== "user") messages = messages.slice(1);
  if (!messages.length || messages[messages.length - 1].role !== "user") return text("Escribe tu pregunta.", 400);

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return text("Tu sesión expiró. Vuelve a ingresar.", 401);

  const { data: remaining, error: usageError } = await supabase.rpc("bump_assistant_usage", { p_limit: DAILY_LIMIT });
  if (usageError) return text("No pude verificar tu límite de uso. Intenta en un momento.", 500);
  if (remaining === -1) return text(`Llegaste al máximo de ${DAILY_LIMIT} preguntas por hoy. Mañana se renueva; si es urgente escribe a soporte.`, 429);

  // Contexto de la tienda: ayuda a personalizar sin exponer datos de clientes.
  const { data: member } = await supabase.from("store_members").select("role, stores(*)").eq("user_id", user.id)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  const store = (member as { stores: Store | null } | null)?.stores ?? null;
  let context = "La persona aún no tiene tienda creada.";
  if (store) {
    const [{ count: products }, { data: sub }, { data: cash }, { count: tables }] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
      supabase.from("subscriptions").select("status, trial_ends_at").eq("store_id", store.id).maybeSingle(),
      supabase.from("cash_sessions").select("id").eq("store_id", store.id).is("closed_at", null).maybeSingle(),
      supabase.from("tables").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    ]);
    const s = sub as Pick<Subscription, "status" | "trial_ends_at"> | null;
    const days = s?.status === "trialing" ? Math.max(0, Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / 86400000)) : null;
    const on = (b?: boolean) => (b ? "activo" : "inactivo");
    context = [
      `Tienda: ${store.name} (enlace /${store.slug}). Rol de la persona: ${member?.role}.`,
      `Página actual del panel: ${parsed.data.path}.`,
      `Módulos: mesas ${on(store.modules?.tables)}, cocina ${on(store.modules?.kitchen)}, caja ${on(store.modules?.pos || store.modules?.tables)}.`,
      `Productos: ${products ?? 0}. Mesas creadas: ${tables ?? 0}. Caja ${cash ? "abierta" : "cerrada"}.`,
      `Entrega: retiro ${store.pickup_enabled ? "sí" : "no"}, delivery ${store.delivery_enabled ? "sí" : "no"}. Tienda ${store.is_published ? "publicada" : "no publicada"}.`,
      `Plan: ${s?.status === "trialing" ? `prueba gratis, quedan ${days} días` : s?.status ?? "desconocido"}.`,
    ].join("\n");
  }

  client ??= new Anthropic();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client!.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          // Conversación de ayuda: esfuerzo bajo basta y responde más rápido.
          output_config: { effort: "low" },
          system: [
            { type: "text", text: `${INSTRUCTIONS}\n\n${KNOWLEDGE}`, cache_control: { type: "ephemeral" } },
            { type: "text", text: `<contexto_tienda>\n${context}\n</contexto_tienda>` },
          ],
          messages,
        }, { signal: req.signal });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\nNo puedo ayudar con esa pregunta. Si es sobre el programa, intenta con otras palabras."));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("…"));
        }
      } catch (err) {
        if (req.signal.aborted) { controller.close(); return; }
        const msg = err instanceof Anthropic.RateLimitError ? "Hay muchas consultas en este momento. Intenta en unos segundos."
          : err instanceof Anthropic.AuthenticationError ? "La clave de la API del asistente no es válida. Avísale al administrador."
          : err instanceof Anthropic.APIConnectionError ? "No pude conectarme con el asistente. Revisa tu conexión."
          : "El asistente tuvo un problema. Intenta de nuevo.";
        console.error("[asistente]", err);
        controller.enqueue(encoder.encode(`\n\n⚠️ ${msg}`));
      }
      controller.close();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Remaining": String(remaining) },
  });
}
