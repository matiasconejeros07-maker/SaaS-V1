/**
 * Marca del producto. El nombre definitivo aún no está decidido:
 * cámbialo aquí o con la variable NEXT_PUBLIC_BRAND_NAME.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Mostrador",
  domain: process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? "mostrador.cl",
  supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "hola@mostrador.cl",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
} as const;

/** Enlace público de una tienda. */
export const storeUrl = (slug: string) => `${BRAND.siteUrl}/${slug}`;

/**
 * Precio único del plan. Es la única fuente de verdad: la landing,
 * el panel y el cobro leen de aquí (Lettera mostraba dos precios distintos).
 */
export const PLAN = {
  name: "Plan Pro",
  priceClp: 19990,
  trialDays: 30,
} as const;
