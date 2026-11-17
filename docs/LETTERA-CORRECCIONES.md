# Problemas detectados en Lettera y cómo se resuelven aquí

| Problema en Lettera | Solución en este proyecto |
|---|---|
| Precio contradictorio ($19.990 en la web, $9.990 en el panel) | Un solo precio en `src/config/brand.ts`, usado por landing, panel y cobro. |
| Datos reales de otra tienda visibles en la demo pública | No hay demo con datos de producción; RLS impide ver datos de otra tienda. |
| Pantalla de carga a pantalla completa en cada clic (video) | Navegación del lado del cliente de Next.js; sin bloqueos entre secciones. |
| 27 opciones en el menú siempre visibles | 5 grupos; módulos se activan o desactivan; lo inactivo se marca. |
| Widgets superpuestos (novedades, ideas, cookies, chat, tour) | Un solo aviso a la vez (toast); sin capas fijas sobre el contenido. |
| WhatsApp mostrado como "++569…" | Teléfono normalizado a `569XXXXXXXX` y formateado `+56 9 XXXX XXXX`. |
| Saludo "Buenas tardes, Cliente" | Usa el nombre real del dueño; sin nombre, solo el saludo. |
| Horario "Cerrado" en configuración pero abierto en la tienda | Una sola tabla `opening_hours` para panel, tienda y validación del pedido. |
| Pedidos de "1097 h" sin alerta | Alerta de atraso por columna y opción de anular con confirmación. |
| Precios del pedido armados en el navegador | `place_order` recalcula todo en el servidor y valida stock, horario y pago. |
| Colores e íconos inconsistentes, emojis como íconos | Sistema de diseño con tokens, íconos SVG (Lucide), modo claro y oscuro. |
| Hosting compartido Windows y sondeo cada 60 s | Supabase + Vercel; pedidos por tiempo real (WebSocket). |
| Correo público "superadmin@" | Correo de soporte configurable. |
