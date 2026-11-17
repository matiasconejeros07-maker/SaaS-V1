/** Esqueleto inmediato mientras carga una sección del panel (la barra lateral se mantiene). */
export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Cargando">
      <div className="sk-row"><div className="skeleton sk-title" /><div className="skeleton sk-sub" /></div>
      <div className="sk-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>
      <div className="skeleton sk-block" />
    </div>
  );
}
