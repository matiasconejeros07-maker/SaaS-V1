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
✅ Hecho:
- **Mesas y QR**: crear, renombrar y eliminar mesas; hoja imprimible de QR; estado libre/ocupada con total por cobrar.
- **Pedido en mesa**: el cliente escanea, pide sin datos personales y paga en el local.
- **Pantalla de cocina**: pantalla completa, en vivo, tiempos con colores, aviso sonoro, filtros por tipo.
- **Caja POS**: búsqueda y lector de código de barras, venta por kilo, vuelto con billetes rápidos, comandas a cocina.
- **Caja**: apertura con sencillo, resumen por medio de pago, cierre con cuadratura (sobra/falta).

Pendiente:
- **Inventario**: historial de movimientos, ingreso de mercadería, alertas de reposición.
- **Equipo**: invitar meseros y cajeros con su propio acceso (rol `staff`, ya soportado en la base) y PIN rápido.
- Impresión de comandas en impresora térmica.
- Historial de cajas cerradas.

## Fase 4 — Crecimiento
- Fidelidad (tarjeta de sellos), cupones, reportes con alertas.
- Boletas: integración con proveedor de boleta electrónica (SII).
- Dominio propio por tienda, WhatsApp Business API para confirmaciones automáticas.
- Directorio público de tiendas.
