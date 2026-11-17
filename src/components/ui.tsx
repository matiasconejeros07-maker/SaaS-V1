"use client";
import { Check, Store, X } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BRAND } from "@/config/brand";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link className="logo" href={href}>
      <span className="logo-mark"><Store /></span>
      {BRAND.name}
    </Link>
  );
}

/* ---------- Toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 2400);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status" aria-live="polite">
          <Check /> {msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

/* ---------- Drawer ---------- */
export function Drawer({
  title, open, onClose, children, footer,
}: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus(), 30);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="drawer-h">
          <h3>{title}</h3>
          <button className="btn btn-soft btn-icon" type="button" onClick={onClose} aria-label="Cerrar"><X /></button>
        </div>
        <div className="drawer-b">{children}</div>
        {footer && <div className="drawer-f">{footer}</div>}
      </aside>
    </>
  );
}

export function Field({ label, htmlFor, hint, error, children, className }: {
  label: string; htmlFor?: string; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="err" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
