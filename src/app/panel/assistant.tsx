"use client";
import { ArrowUp, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
const KEY = "asistente:conversacion";

const SUGGESTIONS: Record<string, string[]> = {
  "/panel/pedidos": ["¿Cómo anulo un pedido?", "¿Por qué un pedido sale como atrasado?", "¿Cómo activo el sonido de pedidos nuevos?"],
  "/panel/productos": ["¿Cómo vendo un producto por kilo?", "¿Cómo controlo el stock?", "¿Cómo agrego un código de barras?"],
  "/panel/caja": ["¿Cómo abro y cierro la caja?", "¿Cómo calculo el vuelto?", "¿Cómo envío una comanda a cocina?"],
  "/panel/mesas": ["¿Cómo imprimo los QR de las mesas?", "¿Cómo cobro una mesa?", "¿Cómo pide un cliente desde la mesa?"],
  "/panel/configuracion": ["¿Cómo cambio mi horario?", "¿Cómo pongo un pedido mínimo?", "¿Dónde pongo mis datos de transferencia?"],
  "/panel/plan": ["¿Cuánto cuesta el plan?", "¿Qué pasa cuando termina la prueba?"],
  "/panel": ["¿Qué me falta para empezar a vender?", "¿Cómo comparto mi tienda?", "¿Cómo funciona el gráfico de ventas?"],
};

/** Negrita (**texto**), listas y saltos de línea, sin interpretar HTML. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list.ordered ? "ol" : "ul";
    blocks.push(<L key={blocks.length}>{list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</L>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    if (ol || ul) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((ol ?? ul)![1]);
    } else {
      flush();
      if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

export function Assistant() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    try { const s = sessionStorage.getItem(KEY); if (s) setMessages(JSON.parse(s)); } catch { /* */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current || busy) return;
    try { sessionStorage.setItem(KEY, JSON.stringify(messages.slice(-40))); } catch { /* */ }
  }, [messages, busy]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  // El botón "Ayuda" de la barra superior abre o cierra el asistente.
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener("asistente:toggle", toggle);
    return () => window.removeEventListener("asistente:toggle", toggle);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open && !busy) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function send(textIn?: string) {
    const q = (textIn ?? input).trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, messages: history.filter((m) => m.content.trim()) }),
        signal: ctrl.signal,
      });
      const left = res.headers.get("X-Remaining");
      if (left !== null) setRemaining(Number(left));
      if (!res.ok || !res.body) {
        const msg = (await res.text().catch(() => "")) || "No pude responder ahora. Intenta de nuevo.";
        setMessages([...history, { role: "assistant", content: msg }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: acc }]);
      }
      if (!acc.trim()) setMessages([...history, { role: "assistant", content: "No obtuve respuesta. Intenta de nuevo." }]);
    } catch {
      setMessages((m) => {
        const last = m[m.length - 1];
        if (ctrl.signal.aborted) return last?.content ? m : m.slice(0, -1);
        return [...history, { role: "assistant", content: "Se cortó la conexión. Revisa tu internet e intenta de nuevo." }];
      });
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  const suggestions = SUGGESTIONS[Object.keys(SUGGESTIONS).find((k) => path === k || (k !== "/panel" && path.startsWith(k))) ?? "/panel"];

  return (
    <>
      {open && (
        <section className="ai-panel" role="dialog" aria-label="Asistente de ayuda">
          <header className="ai-head">
            <span className="ai-badge"><Sparkles /></span>
            <div><b>Asistente</b><span>Pregúntame cómo usar el programa</span></div>
            {messages.length > 0 && (
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Nueva conversación" disabled={busy}
                onClick={() => { setMessages([]); try { sessionStorage.removeItem(KEY); } catch { /* */ } }}><RotateCcw /></button>
            )}
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Cerrar" onClick={() => { abort.current?.abort(); setOpen(false); }}><X /></button>
          </header>

          <div className="ai-list" ref={listRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="ai-empty">
                <p>Hola. Puedo explicarte cualquier parte del panel: pedidos, productos, caja, mesas, cocina, horarios o tu plan.</p>
                <div className="ai-sugs">
                  {suggestions.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                {m.role === "assistant"
                  ? (m.content ? <Rich text={m.content} /> : <span className="ai-typing" aria-label="Escribiendo"><i /><i /><i /></span>)
                  : <p>{m.content}</p>}
              </div>
            ))}
          </div>

          <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea ref={inputRef} rows={1} value={input} maxLength={4000} placeholder="Escribe tu pregunta…" aria-label="Tu pregunta"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
            {busy
              ? <button type="button" className="ai-send" aria-label="Detener" onClick={() => abort.current?.abort()}><Square /></button>
              : <button type="submit" className="ai-send" aria-label="Enviar" disabled={!input.trim()}><ArrowUp /></button>}
          </form>
          <p className="ai-foot">Respuestas generadas por IA; pueden tener errores.{remaining !== null && remaining <= 10 ? ` Te quedan ${remaining} preguntas hoy.` : ""}</p>
        </section>
      )}
    </>
  );
}
