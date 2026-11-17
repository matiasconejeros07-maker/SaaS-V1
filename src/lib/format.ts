/** Utilidades de formato para Chile. */

export const clp = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-CL", { maximumFractionDigits: 0 });

/** Normaliza un celular chileno a 569XXXXXXXX. Acepta "9 1234 5678", "+56 9...", etc. */
export function normalizeCLPhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (/^9\d{8}$/.test(d)) d = "56" + d;
  return /^569\d{8}$/.test(d) ? d : null;
}

/** 56912345678 → +56 9 1234 5678 */
export function formatCLPhone(d: string | null | undefined): string {
  if (!d) return "";
  return /^569\d{8}$/.test(d) ? `+56 9 ${d.slice(3, 7)} ${d.slice(7)}` : d;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function qty(n: number, unit: string) {
  if (unit === "kg") return `${n.toLocaleString("es-CL", { maximumFractionDigits: 3 })} kg`;
  return `${n}×`;
}

export function minutesAgo(iso: string, now = Date.now()) {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

export function agoLabel(iso: string, now = Date.now()) {
  const m = minutesAgo(iso, now);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d`;
}

export function greeting(tz = "America/Santiago", date = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(date));
  return h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

export const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
