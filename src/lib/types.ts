/**
 * Tipos de las tablas principales. Reflejan supabase/migrations.
 * Cuando exista el proyecto en Supabase se pueden regenerar con:
 *   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 */

export type MemberRole = "owner" | "admin" | "staff";
export type OrderStatus = "new" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderChannel = "web" | "table" | "pos";
export type Fulfillment = "pickup" | "delivery" | "dine_in";
export type PaymentMethod = "cash" | "transfer" | "debit" | "credit" | "mercadopago";
export type PaymentStatus = "pending" | "paid" | "refunded" | "failed";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "paused" | "cancelled";

export interface Store {
  id: string;
  slug: string;
  name: string;
  whatsapp: string;
  business_type: string | null;
  region: string | null;
  commune: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  timezone: string;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  delivery_fee: number;
  min_order: number;
  accepts_cash: boolean;
  accepts_transfer: boolean;
  accepts_mercadopago: boolean;
  transfer_details: string | null;
  is_published: boolean;
  modules: { tables: boolean; kitchen: boolean; pos: boolean; inventory: boolean };
  created_at: string;
}

export interface OpeningHour {
  store_id: string;
  weekday: number;
  opens: string;
  closes: string;
}

export interface Category {
  id: string;
  store_id: string;
  name: string;
  position: number;
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  unit: "unit" | "kg";
  image_url: string | null;
  is_available: boolean;
  dine_in_only: boolean;
  track_stock: boolean;
  stock: number;
  position: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  unit: "unit" | "kg";
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  id: string;
  store_id: string;
  number: number;
  status: OrderStatus;
  channel: OrderChannel;
  fulfillment: Fulfillment;
  table_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  address: string | null;
  note: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  order_items?: OrderItem[];
}

export interface Subscription {
  store_id: string;
  plan: string;
  status: SubscriptionStatus;
  trial_ends_at: string;
  current_period_end: string | null;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Nuevo",
  preparing: "Preparando",
  ready: "Listo",
  completed: "Entregado",
  cancelled: "Anulado",
};

export const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  pickup: "Retiro",
  delivery: "Delivery",
  dine_in: "Mesa",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  debit: "Débito",
  credit: "Crédito",
  mercadopago: "Mercado Pago",
};

export const BUSINESS_TYPES: { id: string; label: string; group: string }[] = [
  { id: "cafe", label: "Café y pastelería", group: "Comida" },
  { id: "restaurante", label: "Restaurante", group: "Comida" },
  { id: "comida_rapida", label: "Comida rápida", group: "Comida" },
  { id: "pizzeria", label: "Pizzería", group: "Comida" },
  { id: "panaderia", label: "Panadería", group: "Comida" },
  { id: "botilleria", label: "Botillería", group: "Comercio" },
  { id: "almacen", label: "Almacén o minimarket", group: "Comercio" },
  { id: "ropa", label: "Ropa y accesorios", group: "Comercio" },
  { id: "tecnologia", label: "Tecnología", group: "Comercio" },
  { id: "mascotas", label: "Mascotas", group: "Comercio" },
  { id: "flores", label: "Flores y plantas", group: "Comercio" },
  { id: "belleza", label: "Belleza y estética", group: "Servicios" },
  { id: "taller", label: "Taller o reparaciones", group: "Servicios" },
  { id: "otro", label: "Otro", group: "Otros" },
];
