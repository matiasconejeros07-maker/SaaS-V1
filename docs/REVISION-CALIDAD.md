# Revisión de calidad (18 nov 2026)

Fallos encontrados al revisar el código y cómo se corrigieron. Cada uno tiene prueba automática en `supabase/tests/30_hardening_test.sql` o en las pruebas de navegador.

| # | Fallo | Impacto | Corrección |
|---|---|---|---|
| 1 | El saludo del panel usaba la hora del servidor (UTC en Vercel) | Decía "Buenas noches" a las 18:00 en Chile | Se calcula en la zona horaria de la tienda |
| 2 | Guardar el horario borraba y luego insertaba desde el navegador | Si fallaba la segunda parte, la tienda quedaba sin horario y no recibía pedidos | Función `set_opening_hours` atómica |
| 3 | El rol "personal" podía editar precios y nombres de productos | Un empleado podía cambiar precios | Trigger: el personal solo marca agotado o ajusta stock |
| 4 | La caja asociada y el monto recibido de una venta eran editables | Se podía mover o sacar una venta de la cuadratura | Campos de caja inmutables; solo la base de datos los limpia al borrar una mesa o caja |
| 5 | Al endurecer (4), borrar una mesa con pedidos antiguos fallaba | No se podían eliminar mesas | Se permite el null solo cuando lo hace la acción `ON DELETE SET NULL` |
| 6 | Enlaces `cocina` y `pedido` permitidos | Una tienda con ese enlace quedaba tapada por una página de la app | Palabras reservadas en la base y en el asistente |
| 7 | Errores técnicos en inglés al crear tienda | Mensajes incomprensibles | Mensajes en español para nombre y enlace |
| 8 | Producto con stock 0 seguía "disponible" | El cliente lo agregaba y el pedido fallaba al final | Se agota solo con stock 0 y vuelve al reponer |
| 9 | La dueña podía quitarse a sí misma de la tienda | Tienda sin dueña | Políticas separadas que protegen a la dueña |
| 10 | Vistas previas de imágenes sin liberar memoria | Lentitud tras subir varias fotos | `URL.revokeObjectURL` al cambiar o cerrar |
| 11 | El carrito podía borrarse al cargar la tienda | Se perdía el pedido armado | Se guarda solo después de leer el carrito anterior |
| 12 | El tablero se reconectaba al activar el sonido | Pedidos podían perderse en la reconexión | Sonido en referencia, el canal no se reinicia |
| 13 | Tiempos "hace X min" distintos entre servidor y navegador | Avisos de hidratación en consola | Marcados como contenido que cambia en el cliente |
| 14 | Sin forma de marcar pagado un pedido web en efectivo | Ventas web no entraban a la caja | Botón "Marcar pagado" y función `mark_order_paid` |
| 15 | En mesas sin pantalla de cocina el mesero no podía anotar pedidos | Mesas sin comanda | Botón "Anotar en Mesa X" |

## Mejoras de fluidez y diseño
- Esqueletos de carga dentro del panel (la barra lateral no desaparece) en lugar de pantallas de carga completas.
- Paleta de comandos con ⌘K o `/` para ir a cualquier sección o acción.
- Gráfico de ventas de 14 días con comparación semanal.
- Tienda: encabezado compacto al bajar, categorías que siguen el scroll, buscador, ficha de producto con cantidad, carrito con animación y hojas que suben desde abajo en el celular.
- Microinteracciones (presión de botones, transiciones de 140–220 ms) que respetan "reducir movimiento".
- Imágenes de producto ausentes reemplazadas por la inicial con un tono propio por producto.
