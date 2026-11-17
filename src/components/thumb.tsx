/** Imagen de producto o, si no hay, un mosaico con la inicial y un tono derivado del nombre. */
export function hueOf(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Thumb({ name, src, className = "thumb", size }: { name: string; src?: string | null; className?: string; size?: number }) {
  const style = { ["--h" as string]: hueOf(name), ...(size ? { width: size, height: size } : {}) } as React.CSSProperties;
  return (
    <span className={`${className} ph`} style={style} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span className="ph-letter">{name.trim()[0]?.toUpperCase() ?? "·"}</span>}
    </span>
  );
}
