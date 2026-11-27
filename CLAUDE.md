# AgendoMX — CLAUDE.md

Producto de FORMA/01 · "AgendoMX de FORMA/01"
Estado: MVP en construcción · Meta: producción en 15 días (5 fases, ver sección 11)

Documentos relacionados: `docs/PRODUCT_SPEC.md` (reglas de negocio, estados, post-MVP) y `docs/BRAND.md` (marca, logo, color, tipografía, temas). Si hay conflicto, el alcance lo define la sección 10 de este archivo.

## 1. Qué es AgendoMX

Plataforma web (PWA) para negocios que trabajan por cita en México: barberías, salones de uñas, estilistas, fisioterapeutas, psicólogas, nutriólogos, etc.

Dos tipos de usuario:

1. **Dueño del negocio (owner):** crea su cuenta, configura su perfil, servicios y horarios, e instala la PWA en su celular para ver y gestionar sus citas del día.
2. **Cliente final:** entra al perfil público del negocio (por el link que le compartieron) y agenda una cita sin crear cuenta.

El perfil público funciona como tarjeta de presentación digital: nombre, foto o logo, descripción, servicios con precio y duración, ubicación, contacto (WhatsApp, teléfono, redes) y el botón "Agendar cita".

URL pública del negocio: `https://agendomx.com/{slug}` (ej. `agendomx.com/barberia-juan`).

### Principios de producto

- **Simple primero.** El dueño debe quedar configurado en menos de 5 minutos desde su celular.
- **Mobile-first.** Casi todos los dueños y clientes usan solo el teléfono. Diseña primero para 375px.
- **Cero fricción para el cliente final.** Nada de registro: nombre + teléfono (+ correo opcional).
- **Español de México**, tono profesional y cálido, trato de "tú". Nada de modismos excesivos.
- **No es un expediente clínico.** No guardamos notas clínicas ni datos de salud. Solo agenda.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript estricto. Lee `AGENTS.md`: las guías de esta versión están en `node_modules/next/dist/docs/` |
| Hosting | Cloudflare Workers vía `@opennextjs/cloudflare` (plan Workers Paid) |
| Base de datos | Neon Postgres (plan Free al inicio) |
| Conexión BD | Cloudflare Hyperdrive + driver `postgres` (postgres.js) |
| ORM / migraciones | Drizzle ORM + drizzle-kit |
| Auth (solo dueños) | Better Auth con adaptador Drizzle (email + contraseña; Google OAuth opcional, ver sección 10) |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Validación | Zod (compartido entre cliente y servidor) |
| Formularios | react-hook-form + @hookform/resolvers/zod |
| Fechas | date-fns v4 + `@date-fns/tz` (sucesor oficial de date-fns-tz para v4) |
| Teléfonos | `libphonenumber-js/min` (normalizar a E.164 `+52` + 10 dígitos; `+521` ya no aplica) |
| Imágenes | Cloudflare R2 (logos, portadas). Compresión en el cliente antes de subir |
| Mapa | Link "Cómo llegar" (Google Maps URL) + embed de OpenStreetMap. Sin API key de Google Maps |
| Correo transaccional | Resend + React Email (se configura en la Fase 1: auth lo necesita) |
| Anti-abuso | Cloudflare Turnstile + rate limit en Postgres (tabla `rate_limits`) + honeypot |
| Observabilidad | Workers Logs + Sentry (`@sentry/cloudflare`) desde la Fase 1 |
| Tareas programadas | Cloudflare Cron Trigger en el mismo Worker (`scheduled` en `worker.ts` → `POST /api/cron/tick`) |
| PWA | manifest + service worker (Serwist o manual) |
| Tests | Vitest (unitarias de disponibilidad + integración del constraint) + Playwright (flujo de reserva) |
| Package manager | pnpm |

### Restricciones del runtime (Workers)

- No hay filesystem ni APIs exclusivas de Node que no soporte `nodejs_compat`. Antes de agregar una dependencia, verifica que funcione en Workers.
- Evita trabajo pesado de CPU por request. Las consultas a BD no cuentan como CPU, el render sí.
- No uses `export const runtime = 'edge'`: OpenNext corre en modo Node.
- Accede a bindings (Hyperdrive, R2, Rate Limiting, variables) con `getCloudflareContext()` de `@opennextjs/cloudflare`.
- Crea la conexión a BD por request a partir de `env.HYPERDRIVE.connectionString`. No uses un cliente global. `getDb()` ya memoiza **un cliente por request** (WeakMap por `ctx` de la ejecución): llámalo cuantas veces quieras, no abras pools propios. Antes cada llamada abría un pool que nadie cerraba y agotó las conexiones de Postgres local.
- `next/image` no optimiza en Workers por defecto: usa un loader propio o imágenes ya comprimidas.
- **Cache Components (`cacheComponents`) está desactivado**: OpenNext para Cloudflare aún no lo soporta por completo. No lo actives ni uses `"use cache"` hasta que OpenNext lo soporte.
- Postgres detrás de Hyperdrive: `postgres(url, { prepare: false })`. Verificado en workerd con `/api/health`.
- Server actions: validan con Zod, resuelven `business_id` de la sesión (`getCurrentBusiness()`), y **reciben el input crudo del formulario** (`getValues()`), nunca la copia ya transformada por el resolver (rompió el paso 1 cuando un campo transformado volvía como `null`). Los ids que llegan de URLs/forms se revisan con `isUuid()` antes de consultar: un id mal formado es "no encontrado", no un 500.
- Imágenes (logo/portada): el navegador las recorta/reduce con canvas (`lib/image-compress.ts`, sin metadatos), el servidor las valida **por sus bytes** (formato real, ≤ 1 MB, 32–4096 px) y las guarda en R2 con clave aleatoria `businesses/{id}/{logo|cover}-{12 chars}.{ext}`; `logo_url`/`cover_url` guardan la ruta `/media/…` (CHECK en BD). Subir/quitar borra el objeto anterior y lo purga de la caché de borde de esa ubicación (`media-cache.ts`; las demás expiran en ≤ 1 h); 20 subidas por hora por negocio. En `next dev` el estado local de R2 vive en `$TMPDIR/agendomx-wrangler-state` (dentro del proyecto el watcher recompilaba en bucle).
- Reserva pública (Fase 3): `server/queries/public.ts` mapea filas a DTOs explícitos (nunca se hace spread de una fila hacia el navegador; `businessId`/`staffId` no salen del servidor). `createPublicBooking` (`server/actions/booking-writes.ts`) corre en una transacción con un advisory lock por staff, revalida el slot con el motor de disponibilidad y deja la constraint `23P01` como respaldo (ambos caminos regresan `slot_taken`). Un teléfono puede tener máx. 3 citas próximas activas por negocio. Anti-abuso en la action: honeypot → forma (Zod) → rate limit por IP (20/h) → Turnstile → rate limit por teléfono (6/día); claves hasheadas. Turnstile (`lib/turnstile.ts`): con llaves se exige; sin llaves **producción falla cerrado** y desarrollo lo omite. La site key se lee en runtime en el servidor (`TURNSTILE_SITE_KEY`), nunca `NEXT_PUBLIC_`. La site key real va en `vars` de `wrangler.jsonc` (producción y staging) y `TURNSTILE_SECRET_KEY` es un Secret de cada Worker. Las llaves de prueba de Cloudflare (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) sirven para e2e automatizados; no las pongas como `vars` junto a un Secret del mismo nombre (el deploy falla). Correos de cita: categorías de salud nunca nombran el servicio al cliente; el aviso al dueño va al correo de su cuenta. El mapa OSM solo se muestra si hay coordenadas (`lat/lng` o extraídas del link con `extractCoords`); los links cortos `maps.app.goo.gl` aún no se resuelven.
- Cron (Fase 4): **no hay Worker aparte**. `worker.ts` exporta `scheduled`, que llama por el binding `WORKER_SELF_REFERENCE` a `POST /api/cron/tick`; así el trabajo corre por el camino normal de OpenNext y reutiliza `getDb()`, los correos y el manejo de env (un `scheduled` crudo no tiene `getCloudflareContext` ni `process.env` poblado). Se autentica con `Bearer HMAC(BETTER_AUTH_SECRET, "agendomx-cron-v1")` (`lib/cron-auth.ts`): no requiere otro secret, y sin token la ruta responde 404. Corre cada hora (`triggers.crons` en `wrangler.jsonc`; minuto 7 en producción, 37 en staging). Cada tick (`server/actions/cron-run.ts`): expira `pending` vencidas (evento `expired`, actor `system`), manda recordatorios y limpia `rate_limits`. Recordatorio: cita `confirmed`, con correo, que empieza entre 2 h y 24 h desde ahora y que se reservó con más de 24 h de anticipación (quien reserva para mañana en la mañana ya recibió su confirmación). Idempotente: `claimDueReminders` marca `reminder_sent_at` y toma filas con `FOR UPDATE SKIP LOCKED`; si el envío falla se libera para el siguiente tick. Un fallo no detiene el resto del lote.
- PWA (Fase 4), sin dependencias nuevas: `src/app/manifest.ts` (`/manifest.webmanifest`, `start_url` `/app`, standalone), íconos PNG en `public/icons/` (generados del isotipo; el maskable deja el logo dentro del 80 %), `public/sw.js` escrito a mano y `/offline` estático. El service worker **nunca cachea HTML** (el panel muestra datos privados): las navegaciones van a la red y, si fallan, muestra `/offline` precacheado; solo `/_next/static/*` es cache-first (URLs con hash). `/offline` usa un formulario GET y no JS, porque se sirve sin red y sus chunks no están en caché. El SW se registra solo en producción (`ServiceWorkerRegister` en el layout del panel); en dev cachearía chunks sin hash. `InstallPrompt` ofrece instalar (evento `beforeinstallprompt` en Android/desktop, instrucciones de Compartir en iPhone) y se descarta con localStorage. `offline`, `icons`, `sw.js` y `manifest.webmanifest` son slugs reservados. Para probar: `pnpm preview --port 8788` (build de producción en workerd; el origen de Better Auth ahí es `https://agendomx.com`, cookie `__Secure-…`).
- Respaldos (Fase 5): `.github/workflows/backup.yml` (diario 08:17 UTC desde `main`, o manual) → `scripts/backup/` → bucket privado R2 `agendomx-backups/<env>/`. `pg_dump` corre con la imagen `postgres:19` (mismo major que Neon; un cliente más viejo se niega). Cada corrida baja de R2 lo que subió y lo restaura en un Postgres 19 efímero (`verify-restore.sh`: checksum, `btree_gist`, `appointments_no_overlap`, conteos vs. manifest) **antes** de aplicar la retención (30 días, mínimo 7 copias; `retention.sh` solo toca claves con formato de respaldo). `verify-restore.sh` se niega a restaurar en una base con tablas. Secrets de GitHub: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `DATABASE_URL_PRODUCTION` (sin pooler) y opcional `DATABASE_URL_STAGING`; la elección de base es explícita (nunca cae de staging a producción). Runbook y restauración de emergencia: `docs/BACKUPS.md`.
- E2E (Fase 5): `tests/e2e/` con `@playwright/test` (fijado a la versión del Chromium preinstalado), a 375px, contra `next dev` real en el **puerto 3100** (nunca reutiliza un `pnpm dev` abierto, que apunta a la base de desarrollo) y una base desechable `agendomx_e2e` (Hyperdrive local se redirige con `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`; `E2E_DATABASE_URL` la cambia; `global-setup.ts` se niega a borrar una base cuyo nombre no contenga `e2e` o `test`). Global setup: migra, crea dos dueños con el sign-up real (uno en modo auto y otro manual) y sus negocios; cada spec limpia reservas/clientes/rate limits (`resetBookings`). Sin llaves de Turnstile ni Resend (dev las omite). Cubre: perfil público, reserva → cita → cancelar, horario cancelado que se puede volver a reservar, **dos personas por el mismo horario**, teléfono inválido, honeypot, modo manual (pendiente), 404 amables, login, aceptar/rechazar/cancelar, recordatorio de WhatsApp, cita manual (incl. hora libre que choca), Semana y **aislamiento entre negocios**. Los tokens sembrados deben tener exactamente 32 caracteres (la app rechaza otra forma). Una carga de `next dev` sin hidratar ignora clics: usa `hydrated()` antes de interactuar con formularios. Workflow `e2e.yml` corre en cada PR a `main` con Postgres 19 de servicio. Se verificó que las pruebas fallan si se rompe la cancelación.
- Legal y privacidad (Fase 5): los textos viven en `docs/legal/*.md` y se convierten con `pnpm legal:sync` a `src/content/legal/generated.ts` (Workers no leen archivos; una prueba falla si están desincronizados). Páginas `/terminos`, `/privacidad` y `/{slug}/privacidad` (esta nombra al negocio como responsable), casilla de aceptación en el registro (`user.terms_version` / `terms_accepted_at`, validada por un hook de Better Auth) y aviso corto en la reserva están **detrás de `LEGAL_PUBLISHED`** (var de runtime, leída con `legalPublished()`; staging y E2E la encienden, producción no hasta que legal apruebe; una prueba impide publicar textos con marcadores `[VERIFICAR]`/BORRADOR). Autoservicio de borrado: `Perfil → Mi cuenta` (`deleteOwnerAccount`: una transacción con lock por dueño; borra citas→clientes→negocio→usuario, imágenes de R2 al final y verificaciones; confirma escribiendo el nombre del negocio) y `Perfil → Tus clientes` (`anonymizeClient`: reemplaza nombre/celular/correo/notas por marcadores, pone `anonymized_at`, **rota los `public_token`** para invalidar links ya enviados y se niega si hay citas próximas `pending`/`confirmed`). El teléfono placeholder es `+99` + 10 dígitos (no es un código de país asignado y cumple el CHECK E.164). El cron también borra sesiones y tokens de verificación vencidos hace más de 1 día. Ojo: en `sql` crudo de Drizzle un `Date` rompe postgres.js; pasa `date.toISOString()` con `::timestamptz`.
- Temas de negocio y rediseño de UI (Fase 5): `businesses.theme` (enum, default `studio`; migración `0008_business_theme`) se elige en `Perfil → Apariencia` (`saveThemeAction`) y solo viste lo público: perfil `/{slug}`, `/{slug}/reservar` y `/cita/{token}`, envueltos en `ThemeScope` (`data-theme-biz="<id>"`). Los colores viven en `globals.css` como variables `--t-*` (Studio en `:root`, los otros cinco en `[data-theme-biz="…"]`) y se usan con utilidades Tailwind **`th-*`** (`bg-th-bg`, `text-th-muted`, `border-th-line`…). No las renombres a `t-*`: `border-t-line` se leería como "borde superior" con el color del panel. Una prueba (`themes.test.ts`) mantiene sincronizados el enum de la base, `THEME_IDS`, el CSS y el esquema Zod, y exige contraste AA en cada tema. `PublicBusiness.theme`/`ClientAppointment.business.theme` pasan por `themeOrDefault()` para que un valor raro nunca rompa una página pública. El panel del dueño mantiene su interfaz neutra y solo toma del tema el **acento** (`--pa`, utilidades `bg-pa`/`text-pa`/`bg-pa-soft`/`text-pa-on`) y el **encabezado** (`PanelBanner`: portada del negocio o `CoverArt`), mediante `data-theme-biz` + `data-panel-theme` en el layout del panel. `data-panel-theme` fuerza `color-scheme: light` (Noir no debe oscurecer controles nativos) y Noir usa un `--pa` más oscuro porque su dorado no tiene contraste sobre superficies claras; `themes.test.ts` lo valida con AA. Colores de estado (pendiente, cancelada, error) y los botones de formularios no se tematizan. Login, registro y onboarding no usan tema.
- Panel responsivo: `PanelNav` es una sola navegación con tres formas (barra inferior en celular, riel de íconos desde `sm`, barra lateral con nombres desde `lg` = 1024px, que cubre iPad horizontal y computadora). El encabezado con logo/salir ya no está en `app/layout.tsx`: vive en `onboarding/layout.tsx`; en el panel, "Cerrar sesión" está en la barra lateral y en `Perfil`. La agenda (`AgendaScreen`) es una línea de tiempo (`AgendaTimeline`) con huecos "Libre · N min", estadísticas arriba y, en pantallas anchas, columna derecha con solicitudes, recordatorios de mañana y QR. Las acciones de una cita se muestran al tocar su encabezado (la siguiente y las de Mañana vienen abiertas).
- Asistente de reserva: calendario mensual (`MonthCalendar`); solo los días con horarios son `radio` del grupo "Día" (los e2e eligen "el tercer día disponible" y, cerca de fin de mes, avanzan de mes con los helpers `pickSlot`/`chooseDay`). El botón principal se dibuja dos veces (tarjeta de resumen en `lg`, barra inferior debajo de `lg`): los dos llevan `key` distinto (`next` / `submit`) para que React no reutilice el mismo nodo al pasar de "Continuar" a "Confirmar cita"; si lo reutiliza, el clic que abre el paso de datos también envía el formulario vacío (lo cubre un e2e).
- Ilustración y correos (Fase 5+): `components/illustrations/illustration.tsx` es el sistema de ilustración "bloques de tiempo" (SVG puro, sin dependencias). Tonos `light`/`dark` (paleta del panel) y `theme` (`th-*`, solo dentro de `ThemeScope`); `animated` agrega movimiento sutil con clases `.ill-*` de `globals.css`, apagado con `prefers-reduced-motion`. Se usa en auth (panel lateral desde `lg`), estados vacíos (`ui/empty-state.tsx`), `/cita/{token}`, cierre del onboarding, 404 y `/offline`. Los correos usan `lib/email/templates/email-layout.tsx` con PNG alojados en `public/brand/email/` (Gmail/Outlook no muestran SVG); se regeneran con `node scripts/email-assets/generate.mjs`. Variante oscura vía `prefers-color-scheme`.
- Después de cambiar `wrangler.jsonc`, corre `pnpm cf-typegen` para regenerar `cloudflare-env.d.ts`.
- El entry del Worker es `worker.ts` (envuelve `.open-next/worker.js` con Sentry). `wrangler.jsonc` apunta a él en `main`.
- Rate limit de auth: `src/lib/rate-limit.ts`, respaldado por Postgres (tabla `rate_limits`, upsert atómico en `src/db/rate-limit.ts`; por IP y por correo hasheado). Se probó el binding de Workers Rate Limiting en staging y **no impuso el límite** (30 intentos sin un solo 429), por eso no se usa. El limitador interno de Better Auth está desactivado porque es en memoria por isolate. Usa el mismo mecanismo para el rate limit de la reserva pública; `BOOKING_RATE_LIMITER` queda sin uso. No uses `instrumentation.ts`: el hook no carga en el bundle de OpenNext y tumba todo el servidor (500 en cada ruta). Sentry captura los `console.error` del Worker. Sentry nunca recibe cookies, cuerpos, query strings (traen tokens) ni IP/correo: ver `src/lib/sentry.ts`.

### Ambientes

- **production:** `agendomx.com` (un solo Worker: landing en `/`, auth y panel en `/login` y `/app`, perfiles en `/{slug}`), rama `production` de Neon. Se puede separar el panel a un subdominio (`app.agendomx.com`) más adelante sin cambiar el modelo.
- **staging:** Worker de preview + rama `staging` de Neon. Todo cambio de esquema se prueba aquí antes de producción.
- **local:** `pnpm dev` contra una rama `dev` de Neon (o Postgres local).

## 3. Estructura del proyecto

```
src/
  app/
    page.tsx                # "/" redirige: con sesión a /app, sin sesión a /login (hasta que exista la landing)
    (marketing)/            # landing, precios, aviso de privacidad, términos
    (auth)/                 # login, registro, recuperar contraseña, verificar correo
    (dashboard)/app/        # panel del dueño (protegido): hoy, agenda, servicios, horarios, perfil, ajustes
      onboarding/           # 4 pasos: negocio, servicio, horario, listo (link/QR). Paso derivado del estado en BD
      (panel)/              # pantallas del panel; su layout exige onboarding terminado y muestra la barra de navegación
        servicios/          # lista (orden, ocultar), nuevo, editar/eliminar
        horarios/           # horario semanal + días especiales (cerrado u horario especial, con rangos)
        perfil/             # menú: imagenes (logo/portada), apariencia (tema), informacion, redes (6), link (QR + cambiar slug), reservaciones
    media/[...key]/         # sirve logos/portadas desde R2; solo claves que generamos (`lib/images.ts`)
    [slug]/                 # perfil público del negocio (card, servicios, ubicación, contacto)
      reservar/             # asistente de reserva: servicio → día/hora → datos (acepta ?servicio=<id>)
    cita/[token]/           # página de la cita para el cliente: ver / cancelar (noindex, no-referrer)
    api/auth/[...all]/      # handler de Better Auth
    # explorar/             # directorio público: POST-MVP (ver sección 10)
  components/
    ui/                     # shadcn
    booking/                # asistente de reserva, calendario mensual, horarios por parte del día, formulario
    public/                 # perfil público y piezas con tema (ThemeScope, CoverArt, campos y avisos temáticos)
    dashboard/
  db/
    schema/                 # esquema Drizzle dividido por dominio
    index.ts                # getDb() por request
  server/
    queries/                # lecturas, SIEMPRE con businessId
    actions/                # server actions (mutaciones)
    services/               # lógica de negocio pura (availability.ts, booking.ts)
  lib/
    auth.ts                 # config de Better Auth
    validators/             # esquemas Zod
    time.ts                 # helpers de zona horaria
    phone.ts                # normalización de teléfonos MX
    reserved-slugs.ts       # slugs que no puede usar un negocio
    copy/                   # textos de UI
    email/                  # plantillas React Email
drizzle/                    # migraciones generadas + SQL manual
```

## 4. Modelo de datos (tablas principales)

Las tablas de auth (`user`, `session`, `account`, `verification`) las genera Better Auth.

- **businesses:** id, owner_user_id, slug (único, validado contra `reserved-slugs.ts`), name, category (enum), description, phone, whatsapp, email, address, city, state, maps_url (nullable), facebook_url, instagram_url, twitter_url, tiktok_url, youtube_url, linkedin_url (nullable; URLs https normalizadas con `lib/social.ts`, con CHECK en BD), lat, lng (nullable), logo_url, cover_url, timezone (default `America/Mexico_City`), theme (enum `studio | noir | bloom | earth | coast | signal`, default `studio`; tokens `--t-*` por tema en CSS, nunca estilos sueltos por página), is_listed (default `false`, para el directorio post-MVP), confirmation_mode (auto | manual, default auto), pending_expiry_hours (modo manual, default 24), booking_lead_time_min (anticipación mínima para reservar), booking_window_days (cuántos días hacia adelante), cancellation_min_hours (anticipación mínima para que el cliente cancele desde su link), cancellation_policy_text, onboarding_completed_at (nullable; define "perfil completo"), plan (free | pro), created_at.
- **staff:** id, business_id, name, avatar_url, is_active. En el MVP cada negocio tiene 1 staff, creado automáticamente con el dueño, pero el modelo ya soporta varios.
- **services:** id, business_id, name, description, duration_min, price_cents (nullable), price_is_from (muestra "desde $X"), buffer_after_min, is_bookable_online, is_active, sort_order.
- **staff_services:** staff_id, service_id (qué staff da qué servicio).
- **availability_rules:** id, staff_id, weekday (0–6), start_time, end_time. Horas locales del negocio. Varias filas por día para turnos partidos, ej. 9–14 y 16–20.
- **availability_exceptions:** id, staff_id, date, start_time (nullable), end_time (nullable), type (closed | custom_hours). Para vacaciones, días festivos y horario especial.
- **clients:** id, business_id, name, phone (E.164), email (nullable), notes_short (nullable, máx. 280 caracteres, sin datos de salud), created_at. Único por (business_id, phone).
- **appointments:** id, business_id, staff_id, service_id, client_id, starts_at (timestamptz), ends_at (timestamptz, = starts_at + duración), blocked_until (timestamptz, = ends_at + buffer_after_min), service_name_snapshot, price_cents_snapshot (nullable), status (pending | confirmed | cancelled | completed | no_show | rejected | expired), source (public_link | manual | directory), public_token (para el link de la cita del cliente), expires_at (nullable; solo `pending`), reminder_sent_at (nullable; idempotencia del cron), cancelled_by, cancel_reason, created_at.
- **rate_limits:** key (PK), window_start, count. Contadores de ventana fija para anti-abuso. Las claves nunca llevan correos ni teléfonos en claro.
- **appointment_events:** id, appointment_id, type, actor (owner | client | system), note (nullable, operativa, sin datos clínicos), created_at. Registro append-only de cambios de estado.

Los snapshots guardan el nombre y precio del servicio al momento de reservar, para que editar un servicio no altere citas pasadas.

### Regla crítica: cero citas dobles

Se garantiza en la base de datos, no solo en la UI. Va como migración SQL manual. El rango usa `blocked_until` para que el buffer también quede protegido:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_blocked_until_check
  CHECK (blocked_until >= ends_at AND ends_at > starts_at);

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, blocked_until, '[)') WITH &&
  )
  WHERE (status IN ('pending', 'confirmed'));
```

Al insertar, captura la violación (código `23P01`) y regresa un error amigable: "Ese horario acaba de ocuparse, elige otro".

Debe existir un test de integración que lance dos inserts simultáneos para el mismo horario y verifique que exactamente uno falla con `23P01`.

## 5. Reglas de negocio

### Zona horaria

- Guarda todo en UTC (`timestamptz`). Convierte a la zona del negocio (`businesses.timezone`) solo para mostrar y para calcular disponibilidad.
- Default `America/Mexico_City`. México ya no tiene horario de verano salvo en la franja fronteriza: no hardcodees offsets, usa siempre la librería con la zona IANA.

### Cálculo de disponibilidad (`server/services/availability.ts`)

Función pura y testeada. Entrada: reglas, excepciones, citas existentes (con `blocked_until`), duración del servicio + buffer, anticipación mínima, ventana de días, "ahora". Salida: slots disponibles por día.

- Granularidad de slots: 15 min por defecto (configurable después).
- Un slot es válido si `[inicio, inicio + duración + buffer)` cabe completo dentro de un bloque de disponibilidad y no choca con `[starts_at, blocked_until)` de citas `pending` o `confirmed`.
- Respeta anticipación mínima y ventana máxima. La ventana va de hoy (fecha local del negocio) a hoy + `booking_window_days` − 1.
- Excepciones: `closed` cierra el día completo (gana sobre todo). `custom_hours` **reemplaza** las reglas semanales de esa fecha (puede haber varias).
- Los slots arrancan al inicio de cada bloque y avanzan según la granularidad. Bloques encimados o contiguos se fusionan.
- `isSlotAvailable()` es la revalidación del servidor: el inicio pedido debe ser exactamente uno de los slots calculados.
- Al crear la cita, el servidor vuelve a validar el slot. Nunca confíes en lo que mande el cliente.

### Flujo de reserva pública

1. El cliente elige servicio, luego fecha, luego hora.
2. Captura nombre, teléfono (validado como celular mexicano y normalizado a E.164 con `lib/phone.ts`) y correo opcional.
3. La server action verifica Turnstile y rate limit, valida con Zod, recalcula disponibilidad, hace upsert del cliente por (business_id, phone) e inserta la cita en una transacción.
4. Estado inicial: `confirmed` si `confirmation_mode = auto` (default); `pending` con `expires_at` si es `manual`. Una cita `pending` bloquea el horario; el cron la pasa a `expired` al vencer. Todo cambio de estado escribe en `appointment_events`.
5. Se manda correo de confirmación al cliente (si dio correo) y aviso al dueño.
6. El cliente recibe el link `/cita/{public_token}` para **ver y cancelar**. Cancelar solo se permite hasta `cancellation_min_hours` antes de la cita; después, se muestra el WhatsApp del negocio. Reprogramar = cancelar y volver a agendar (reprogramación nativa es post-MVP).
7. Protección anti-abuso: rate limit por IP y por teléfono (Postgres, `hitRateLimit`), honeypot y Turnstile desde el inicio.

### Slugs

- Minúsculas, números y guiones; 3–40 caracteres.
- Prohibidos los de `lib/reserved-slugs.ts`, como mínimo: `app`, `api`, `cita`, `explorar`, `login`, `registro`, `recuperar`, `precios`, `privacidad`, `terminos`, `ayuda`, `admin`, `static`, `_next`, `assets`, `favicon.ico`, `manifest.webmanifest`, `sw.js`, `robots.txt`, `sitemap.xml`.

### Panel del dueño (PWA)

- La pantalla principal es "Hoy": lista cronológica de citas del día, con acciones rápidas (marcar como completada, no asistió, cancelar, botón WhatsApp `wa.me` con mensaje prellenado).
- Sección "Mañana" con botón **"Recordar por WhatsApp"** por cita: abre `wa.me` con el recordatorio prellenado. Es el recordatorio principal del MVP (pocos clientes dejan correo) y valida la futura función de pago.
- Vista de semana, crear cita manual, gestionar servicios, horarios, excepciones y perfil.
- Botón "Compartir mi perfil" (Web Share API, con copiar link como fallback) y QR descargable.

## 6. Seguridad y multi-tenancy

- Toda consulta o mutación del panel lleva `business_id` del negocio del usuario autenticado, obtenido de la sesión en el servidor. Nunca lo tomes de params o del body.
- Usa helpers `requireOwner()` / `getCurrentBusiness()` en cada server action y query del dashboard.
- Las rutas públicas solo exponen campos públicos del negocio. Nunca expongas datos de otros clientes ni sus teléfonos.
- `public_token`: aleatorio, mínimo 24 bytes, URL-safe.
- Secretos solo en variables de entorno o secrets de Wrangler. Nunca en el repo.

### Legal (antes de producción)

- Aviso de privacidad y términos conforme a la LFPDPPP vigente (hubo una ley nueva en 2025 y cambió la autoridad; revisar con alguien de legal).
- Roles: el **negocio es el responsable** de los datos de sus clientes; **AgendoMX es el encargado**. Debe quedar explícito en los términos que acepta el dueño.
- Para categorías de salud (psicología, fisioterapia, nutrición), el solo hecho de tener una cita puede considerarse dato sensible: no mostrar el nombre del servicio en correos/recordatorios de forma innecesaria y recolectar solo los datos mínimos.

## 7. Convenciones de código

- TypeScript estricto. Prohibido `any`; si es inevitable, documenta por qué.
- Código, nombres de variables, tablas y commits en inglés. Textos de UI en español de México.
- Centraliza los textos de UI en `src/lib/copy/` para poder ajustar el tono fácilmente.
- Server Components por defecto. `"use client"` solo donde haya interactividad.
- Mutaciones con Server Actions + Zod. Respuestas tipadas `{ ok: true, data } | { ok: false, error }`.
- La lógica de negocio vive en `server/services/` como funciones puras y testeables. No la metas en componentes.
- Dinero en centavos (integer). Formatea con `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })`.
- Fechas en UI con `Intl.DateTimeFormat('es-MX')` y la zona del negocio.
- Accesibilidad: labels en todos los inputs, objetivos táctiles de al menos 44px, contraste AA.
- Commits pequeños con Conventional Commits (`feat:`, `fix:`, `chore:`…).

## 8. Comandos

```bash
pnpm dev              # desarrollo local (next dev)
pnpm preview          # build + preview en runtime de Workers (opennextjs-cloudflare)
pnpm run deploy       # build + deploy a Cloudflare (producción). NO uses `pnpm deploy`: es un comando nativo de pnpm
pnpm deploy:staging   # build + deploy al Worker de staging
pnpm db:generate      # drizzle-kit generate
pnpm db:migrate       # aplica migraciones a Neon (según DATABASE_URL)
pnpm db:studio        # drizzle-kit studio
pnpm test             # vitest (unitarias; las de integración corren si existe DATABASE_URL_TEST)
pnpm test:e2e         # playwright (E2E a 375px; crea/borra la base agendomx_e2e, ver sección 2)
pnpm cf-typegen       # regenera tipos de bindings tras editar wrangler.jsonc
pnpm lint && pnpm typecheck
```

Antes de dar una tarea por terminada, corre `pnpm lint`, `pnpm typecheck` y `pnpm test`. Los archivos de integración corren en serie (`fileParallelism: false`): comparten y recrean el mismo esquema. No encadenes `git push` detrás de un `grep` de resultados de test: sale 0 aunque haya fallas.

`tests/integration/` **borra y recrea el esquema** de la BD de `DATABASE_URL_TEST`: apúntala solo a una base desechable (Postgres local o una rama efímera de Neon), nunca a dev, staging ni producción.

## 9. Variables de entorno

```
DATABASE_URL=            # Neon (migraciones y dev local)
# HYPERDRIVE binding en wrangler.jsonc para producción y staging
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://agendomx.com
GOOGLE_CLIENT_ID=        # opcional en MVP
GOOGLE_CLIENT_SECRET=    # opcional en MVP
RESEND_API_KEY=
EMAIL_FROM="AgendoMX <citas@agendomx.com>"
TURNSTILE_SITE_KEY=      # pública
TURNSTILE_SECRET_KEY=
SENTRY_DSN=              # var pública en wrangler.jsonc (un DSN no es secreto)
SENTRY_ENVIRONMENT=      # var en wrangler.jsonc: production | staging
NEXT_PUBLIC_APP_URL=https://agendomx.com
# Bindings: ASSETS_BUCKET (R2), HYPERDRIVE
```

## 10. Alcance del MVP

**Sí entra:**

- Registro y login del dueño (email + contraseña, verificación de correo y recuperación), onboarding guiado (negocio, servicios, horarios)
- Perfil público con tarjeta de presentación, ubicación (link + mapa OSM), contacto y botón de agendar
- Temas de negocio predefinidos (Studio, Noir, Bloom, Earth, Coast, Signal; `docs/BRAND.md` sección 6): el dueño elige uno en `Perfil → Apariencia`: viste el perfil público y la reserva, y en el panel solo cambia el acento y el encabezado (el resto del panel sigue neutro). Es el gancho para nuevos usuarios (decisión del dueño del producto). Los colores personalizados siguen fuera del MVP
- Reserva sin cuenta, con validación de disponibilidad en el servidor y anti-abuso
- Confirmación manual opcional por negocio (estados `rejected` y `expired`)
- Panel: Hoy, Mañana (recordar por WhatsApp), Semana, cita manual, servicios, horarios, excepciones, perfil
- Correos de confirmación y aviso; recordatorio por correo 24 h antes (cron) para clientes que dieron correo
- Link de la cita para el cliente (ver y cancelar)
- PWA instalable, compartir perfil y QR
- Monitoreo de errores (Sentry) y ambiente de staging
- Backups diarios (`pg_dump` → R2 con GitHub Actions) con **restauración probada**

**Opcional (solo si sobra tiempo):**

- Google OAuth

**No entra todavía (no lo implementes sin pedirlo):**

- Directorio / marketplace `/explorar`, búsqueda, favoritos y cuenta de cliente (decisión confirmada: post-MVP; se activa cuando haya ~30 negocios con perfil completo)
- Roles, invitaciones de colaboradores y membresías de negocio
- Reprogramación nativa desde `/cita/{token}`
- WhatsApp Business API (recordatorios automáticos). Será la primera función de pago.
- Notificaciones push al dueño
- Pagos, anticipos o Mercado Pago
- Varios staff en la UI (el modelo sí los soporta)
- Reseñas, ranking y promociones
- Facturación y suscripciones (por ahora el plan se cambia a mano en BD)
- App nativa, notas clínicas o expedientes

## 11. Plan a producción: 5 fases

Cada fase tiene un criterio de salida. No se avanza sin cumplirlo.

### Fase 1 · Base y pruebas de riesgo (días 1–3)

- Proyecto Next + OpenNext + Wrangler; **deploy a producción el día 1** con Hyperdrive conectado a Neon.
- Ambientes production y staging (Worker de preview + rama de Neon). Sentry conectado.
- Esquema Drizzle completo + migración manual del constraint de no traslape + test de concurrencia.
- Better Auth (email + contraseña) + Resend (verificación de correo y recuperación de contraseña).
- `availability.ts` con tests desde el día 2 (no depende de UI ni BD).
- **Salida:** login funcionando en producción, constraint probado (23P01), tests de disponibilidad en verde.

### Fase 2 · Configuración del negocio (días 4–6)

- Onboarding guiado: datos, slug (con reservados), servicios, horario semanal y excepciones.
- Subida de logo/portada a R2 con compresión en cliente. Perfil editable.
- **Salida:** un dueño queda configurado en menos de 5 minutos desde un celular de 375px.

### Fase 3 · Reserva pública (días 7–9)

- `/{slug}` con tarjeta, servicios, ubicación, contacto y botón de agendar.
- Flujo servicio → fecha → hora → datos; server action transaccional que recalcula disponibilidad.
- Turnstile + rate limit + honeypot.
- `/cita/{token}`: ver y cancelar (respetando `cancellation_min_hours`).
- Correo de confirmación al cliente y aviso al dueño.
- **Salida:** una persona externa agenda desde su celular sin ayuda.

### Fase 4 · Panel del dueño y PWA (días 10–12)

- Hoy, Mañana (recordar por WhatsApp), Semana; acciones sobre citas; cita manual; compartir y QR.
- PWA: manifest, íconos, offline básico.
- Worker de cron: recordatorio por correo a 24 h, idempotente con `reminder_sent_at`.
- **Salida (día 12):** piloto cero, un negocio de confianza usándolo con citas reales.

### Fase 5 · Ajustes finales y lanzamiento (días 13–15)

- E2E del flujo crítico (Playwright).
- Aviso de privacidad y términos revisados; dominio y DNS; correo con SPF/DKIM verificados en Resend.
- Backups diarios a R2 + **una restauración probada** en una rama de Neon.
- Correcciones del piloto cero.
- Alta de los 2–3 negocios piloto en persona.
- **Salida:** pilotos con su perfil compartido y al menos una cita real agendada por un cliente.

## 12. Cómo trabajar en este repo (para Claude)

- Antes de implementar algo grande, propón un plan corto y espera confirmación.
- Respeta el alcance del MVP (sección 10). Si algo parece necesario y no está, pregunta.
- Cualquier cambio de esquema va como migración de Drizzle y se prueba en staging primero. Nunca edites migraciones ya aplicadas.
- Cuando toques `availability.ts`, el constraint o el flujo de reserva, agrega o actualiza tests. Son el corazón del producto.
- Prefiere soluciones simples y con pocas dependencias. Cada dependencia nueva debe funcionar en Workers.
- Si una decisión cambia la arquitectura (sección 2), documéntala aquí.
