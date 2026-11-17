export default function Loading() {
  return (
    <div className="shop" aria-busy="true" aria-label="Cargando la tienda">
      <div className="shop-cover skeleton" style={{ borderRadius: "0 0 24px 24px" }} />
      <div className="shop-head">
        <div className="skeleton" style={{ width: 92, height: 92, borderRadius: 24 }} />
        <div className="skeleton" style={{ height: 34, width: 260 }} />
      </div>
      <div className="cat-sec">
        <div className="products">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 136, borderRadius: 16 }} />)}</div>
      </div>
    </div>
  );
}
