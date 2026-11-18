# Mostrador (nombre provisional)

Plataforma SaaS para que pymes chilenas tengan **tienda online, carta QR y gestión de pedidos** sin comisión por venta.
Pensada para usarla en tu propio negocio y ofrecerla como servicio a otras tiendas (multi-tienda desde el día uno).

> El nombre se cambia en un solo lugar: `src/config/brand.ts` o la variable `NEXT_PUBLIC_BRAND_NAME`.

## Qué incluye esta versión

| Área | Estado |
|---|---|
| Registro e ingreso (correo y contraseña) | ✅ |
| Alta de tienda en 4 pasos con vista previa en vivo | ✅ |
| Panel: inicio con ventas del día, pasos pendientes y enlace para compartir | ✅ |
| Productos: fotos, categorías, venta por unidad o kilo, stock, agotado | ✅ |
| Pedidos en tiempo real (sin recargar), aviso sonoro, alerta de atraso | ✅ |
| Tienda pública con carrito, delivery/retiro, pedido mínimo, horario | ✅ |
| Seguimiento del pedido para el cliente | ✅ |
| Configuración: datos, logo, entrega, pagos, horario, módulos | ✅ |
| Prueba gratis de 30 días por tienda | ✅ |
| Cobro de suscripción y pagos con Mercado Pago | 🔜 Fase 2 |
| Mesas con QR imprimible, cobro de mesa | ✅ |
| Pantalla de cocina en vivo con tiempos | ✅ |
| Caja POS: código de barras, venta por kilo, vuelto, comandas | ✅ |
| Apertura y cierre de caja con cuadratura | ✅ |
| Asistente de ayuda con IA dentro del panel (Claude) | ✅ |
| Inventario con movimientos, usuarios del equipo con PIN | 🔜 Fase 3 |

Ver [docs/ROADMAP.md](docs/ROADMAP.md) para el plan completo y [docs/LETTERA-CORRECCIONES.md](docs/LETTERA-CORRECCIONES.md) para los problemas de Lettera que este proyecto resuelve.

## Tecnología

- **Next.js 15** (App Router, TypeScript) — interfaz y servidor.
- **Supabase** — Postgres, autenticación, almacenamiento de imágenes y tiempo real.
- **Despliegue sugerido:** Vercel (app) + Supabase Cloud (datos).

Seguridad principal (en `supabase/migrations`):
- Cada tabla tiene **Row Level Security**: una tienda nunca ve datos de otra.
- Los pedidos solo se crean con la función `place_order`, que **recalcula precios, despacho y stock en el servidor**. El navegador no puede fijar precios.
- Montos y datos del cliente de un pedido no se pueden editar; los estados solo avanzan en orden.

## Asistente de ayuda (IA)

Botón **Ayuda** en la barra superior del panel (o "Preguntar al asistente" en ⌘K). Responde dudas sobre el programa usando:
- la guía del producto en `src/lib/assistant/knowledge.ts` (**actualízala cuando cambie una pantalla**), y
- el contexto de la tienda: módulos activos, página actual, caja abierta, plan. No envía datos de clientes ni pedidos.

Configuración: `ANTHROPIC_API_KEY` en el servidor (nunca en variables `NEXT_PUBLIC_`). Usa Claude Haiku 5.5 (el modelo más económico) con esfuerzo bajo, respuestas en streaming y caché de la guía.
Si un filtro de seguridad rechaza una pregunta, responde que no puede ayudar con ella. Costo estimado: ~US$0,001 por pregunta. Límite de 60 preguntas por usuario al día (`ASSISTANT_DAILY_LIMIT`).
Sin clave, el botón funciona pero responde que el asistente no está configurado.

## Cómo correrlo en tu computador

Requisitos: Node 22+, Docker Desktop.

```bash
npm install
npx supabase start          # levanta Postgres, Auth, Storage y Realtime en Docker
cp .env.example .env.local  # y pega la URL y ANON_KEY que imprime el comando anterior
npm run dev                 # http://localhost:3000
```

Pruebas de la base de datos (Postgres local, sin Docker):

```bash
bash supabase/tests/run.sh
```

## Cómo publicarlo

1. Crea un proyecto en [supabase.com](https://supabase.com) (región São Paulo, la más cercana a Chile).
2. Aplica las migraciones: `npx supabase link --project-ref <id>` y luego `npx supabase db push`.
3. En Supabase → Authentication → URL Configuration, pon la URL de tu sitio.
4. Importa el repo en [vercel.com](https://vercel.com) y agrega las variables de `.env.example`.
5. Conecta tu dominio.

## Estructura

```
src/app/                 Rutas
  page.tsx               Landing
  ingresar, registro     Acceso y alta de tienda
  panel/                 Panel de la tienda (inicio, pedidos, productos, caja, mesas, configuración, plan)
  cocina/                Pantalla de cocina (pantalla completa)
  [slug]/                Tienda pública (catálogo, carrito, checkout)
  pedido/[token]/        Seguimiento del pedido
src/lib/                 Supabase, tipos, formato chileno, horarios
supabase/migrations/     Esquema, permisos y funciones
supabase/tests/          Pruebas de la base de datos
```
