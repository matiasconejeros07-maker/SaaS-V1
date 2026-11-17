"use client";
import { Field } from "@/components/ui";
import { clp } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

const METHODS: [PaymentMethod, string][] = [["cash", "Efectivo"], ["debit", "Débito"], ["credit", "Crédito"], ["transfer", "Transferencia"]];

/** Montos rápidos: exacto y los billetes chilenos que cubren el total. */
function quickAmounts(total: number) {
  const bills = [1000, 2000, 5000, 10000, 20000];
  const out = new Set<number>([total]);
  for (const b of bills) { const v = Math.ceil(total / b) * b; if (v > total) out.add(v); }
  return [...out].sort((a, b) => a - b).slice(0, 5);
}

export function PaymentPicker({ total, value, onChange }: {
  total: number; value: { method: PaymentMethod; received: number | null }; onChange: (v: { method: PaymentMethod; received: number | null }) => void;
}) {
  const change = value.method === "cash" && value.received !== null ? value.received - total : null;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="field"><span className="label">Medio de pago</span>
        <div className="seg" role="group" aria-label="Medio de pago">
          {METHODS.map(([m, l]) => <button key={m} type="button" aria-pressed={value.method === m} onClick={() => onChange({ method: m, received: null })}>{l}</button>)}
        </div>
      </div>
      {value.method === "cash" && (
        <>
          <Field label="Efectivo recibido" htmlFor="pay-received" hint="Opcional. Sirve para calcular el vuelto.">
            <div className="input-group"><span>$</span>
              <input id="pay-received" inputMode="numeric" value={value.received ?? ""} placeholder={String(total)}
                onChange={(e) => onChange({ ...value, received: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} />
            </div>
          </Field>
          <div className="quick">
            {quickAmounts(total).map((a) => (
              <button key={a} type="button" className="btn btn-soft btn-sm" aria-pressed={value.received === a} onClick={() => onChange({ ...value, received: a })}>
                {a === total ? "Exacto" : clp(a)}
              </button>
            ))}
          </div>
          {change !== null && (
            <div className={`change ${change < 0 ? "neg" : ""}`}>
              <span>{change < 0 ? "Falta" : "Vuelto"}</span><b className="num">{clp(Math.abs(change))}</b>
            </div>
          )}
        </>
      )}
    </div>
  );
}
