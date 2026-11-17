import { DAYS } from "./format";
import type { OpeningHour } from "./types";

/** Día (0-6) y hora "HH:MM" actuales en la zona horaria de la tienda. */
export function nowIn(tz: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")!.value);
  const hm = `${parts.find((p) => p.type === "hour")!.value}:${parts.find((p) => p.type === "minute")!.value}`;
  return { weekday: wd, time: hm };
}

export function openState(hours: OpeningHour[], tz: string, date = new Date()): { open: boolean; label: string } {
  const { weekday, time } = nowIn(tz, date);
  const by = (d: number) => hours.find((h) => h.weekday === d);
  const today = by(weekday);
  const hhmm = (t: string) => t.slice(0, 5);
  if (today && time >= hhmm(today.opens) && time < hhmm(today.closes)) return { open: true, label: `Abierto · cierra ${hhmm(today.closes)}` };
  for (let k = 0; k < 7; k++) {
    const d = (weekday + k) % 7;
    const h = by(d);
    if (h && (k > 0 || time < hhmm(h.opens))) {
      const when = k === 0 ? "hoy" : k === 1 ? "mañana" : `el ${DAYS[d].toLowerCase()}`;
      return { open: false, label: `Cerrado · abre ${when} a las ${hhmm(h.opens)}` };
    }
  }
  return { open: false, label: "Cerrado" };
}
