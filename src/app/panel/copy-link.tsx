"use client";
import { Copy } from "lucide-react";
import { useToast } from "@/components/ui";

export function CopyLink({ url, label }: { url: string; label: string }) {
  const toast = useToast();
  return (
    <div className="share-link">
      <span>{label}</span>
      <button type="button" className="btn btn-soft btn-sm" onClick={() =>
        navigator.clipboard.writeText(url).then(() => toast("Enlace copiado"), () => toast(url))}>
        <Copy />Copiar
      </button>
    </div>
  );
}
