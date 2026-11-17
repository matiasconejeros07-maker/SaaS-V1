import { clp } from "@/lib/format";

type Day = { day: string; orders: number; total: number };

/** Barras de ventas por día. Un solo color de acento; hoy resaltado. Escala única para barras y guías. */
export function SalesChart({ days }: { days: Day[] }) {
  const W = 700, H = 180, padL = 44, padB = 22, padT = 8;
  const max = Math.max(1, ...days.map((d) => d.total));
  const p10 = 10 ** Math.floor(Math.log10(max));
  const m = max / p10;
  const nice = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p10;
  const y = (v: number) => H - padB - (v / nice) * (H - padB - padT);
  const bw = (W - padL) / days.length;
  const short = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  const label = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ventas de los últimos 14 días">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line className="grid" x1={padL} x2={W} y1={y(nice * f)} y2={y(nice * f)} />
          <text x={padL - 8} y={y(nice * f) + 4} textAnchor="end">{short(nice * f)}</text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = padL + i * bw + bw * 0.18, w = bw * 0.64, top = y(d.total);
        const last = i === days.length - 1;
        const tipX = Math.min(Math.max(x + w / 2, padL + 54), W - 54);
        const tipY = Math.max(top - 34, 0);
        return (
          <g key={d.day}>
            <rect x={padL + i * bw} y={padT} width={bw} height={H - padB - padT} fill="transparent" />
            <rect className={`bar ${last ? "today" : ""}`} x={x} y={Math.min(top, H - padB - 2)} width={w} height={Math.max(2, H - padB - top)} rx={4} />
            {(i % 2 === days.length % 2 || last) && <text x={x + w / 2} y={H - 6} textAnchor="middle">{last ? "Hoy" : label(d.day)}</text>}
            <g className="tip">
              <rect x={tipX - 54} y={tipY} width={108} height={26} rx={7} />
              <text x={tipX} y={tipY + 17} textAnchor="middle">{clp(d.total)} · {d.orders}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
