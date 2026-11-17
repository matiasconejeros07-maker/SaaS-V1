"use client";
import { useState } from "react";
import { clp } from "@/lib/format";

export function SavingsCalculator({ plan }: { plan: number }) {
  const [sales, setSales] = useState(2500000);
  const rows: [string, number, boolean?][] = [["Plan fijo", plan, true], ["App con 18% de comisión", sales * 0.18], ["App con 30% de comisión", sales * 0.3]];
  return (
    <div className="card price-card">
      <div><h3>¿Cuánto te ahorras?</h3><p className="muted">Mueve el control según tus ventas online al mes.</p></div>
      <div className="field">
        <label htmlFor="calc">Ventas online al mes</label>
        <input id="calc" type="range" min={200000} max={10000000} step={100000} value={sales} onChange={(e) => setSales(Number(e.target.value))} />
        <output className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{clp(sales)}</output>
      </div>
      <div className="tscroll">
        <table className="compare">
          <thead><tr><th>Modelo</th><th className="r">Costo mensual</th></tr></thead>
          <tbody>
            {rows.map(([n, c, us]) => <tr key={n} className={us ? "us" : ""}><td>{n}</td><td className="r mono">{clp(c)}</td></tr>)}
            <tr><td className="muted">Ahorro al año frente al 18%</td><td className="r mono" style={{ color: "var(--ok)", fontWeight: 800 }}>{clp(Math.max(0, (sales * 0.18 - plan) * 12))}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="hint">Comparación referencial con comisiones típicas de apps de delivery.</p>
    </div>
  );
}
