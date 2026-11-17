# Hoja de ruta

## Fase 1 — Núcleo de venta ✅ (esta versión)
Registro, alta de tienda, catálogo, tienda pública, pedidos en tiempo real, seguimiento, configuración, prueba gratis.

## Fase 2 — Cobros con Mercado Pago
**Suscripciones (cobrar a las tiendas que usan la plataforma)**
- Mercado Pago *Preapproval* (suscripción mensual con tarjeta) desde `/panel/plan`.
- Webhook `/api/mercadopago/webhook` que actualiza `subscriptions` con la service role.
- Avisos 7 y 1 días antes del fin de la prueba; tienda en pausa (sin borrar datos) si no paga.
- Panel de superadministrador para ver tiendas, estados de pago y métricas (MRR, churn).

**Pagos en línea en cada tienda**
- Cada tienda conecta su propia cuenta de Mercado Pago (OAuth). El dinero llega directo a la tienda.
- Checkout Pro desde la tienda pública; `orders.payment_status` se marca `paid` por webhook.

Necesario para empezar: cuenta de Mercado Pago de la empresa con RUT, credenciales de producción y una aplicación en developers.mercadopago.cl.

## Fase 3 — Restaurante y caja
- **Mesas y QR**: CRUD de mesas, impresión de QR por mesa (la tabla `tables` y el pedido en mesa ya existen en la base).
- **Pantalla de cocina**: vista a pantalla completa con temporizadores por comanda.
- **Caja POS**: venta presencial con búsqueda y lector de código de barras; cierre de caja.
- **Inventario**: movimientos de stock, alertas de reposición.
- Usuarios del equipo (mesero, cajero) con roles y PIN.

## Fase 4 — Crecimiento
- Fidelidad (tarjeta de sellos), cupones, reportes con alertas.
- Boletas: integración con proveedor de boleta electrónica (SII).
- Dominio propio por tienda, WhatsApp Business API para confirmaciones automáticas.
- Directorio público de tiendas.
