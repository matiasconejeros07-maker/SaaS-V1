import QRCode from "qrcode";
import { storeUrl } from "@/config/brand";

export const tableUrl = (slug: string, token: string) => `${storeUrl(slug)}?mesa=${token}`;

/** QR en SVG (texto) para un enlace. Funciona en servidor y navegador. */
export function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#17140f", light: "#ffffff" } });
}
