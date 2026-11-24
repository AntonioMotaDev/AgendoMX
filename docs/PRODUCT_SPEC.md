# AgendoMX — Especificación de producto (MVP)

Estado: vigente. Fuente de verdad del alcance es `CLAUDE.md` §10; este documento detalla las reglas de negocio y la visión a mediano plazo. Marca y tono: `docs/BRAND.md`.

## 1. Producto

AgendoMX es una plataforma SaaS multi-tenant de gestión de citas con perfil público por negocio. El valor existe aunque el negocio no reciba un solo cliente por la plataforma: agenda, perfil público y link de reserva ya justifican usarla. Un directorio/marketplace llegará después, cuando haya oferta suficiente.

Principio rector: **la tecnología organiza; el negocio conserva su personalidad.** Concepto: *Calm productivity*.

## 2. Decisiones confirmadas

| Tema | Decisión |
|---|---|
| Reserva sin cuenta | Sí (nombre + teléfono, correo opcional) |
| Cuenta de cliente (historial, favoritos) | **Post-MVP** |
| Marketplace `/explorar` | **Post-MVP** (se activa con ~30 negocios con perfil completo) |
| Confirmación de citas | **Configurable por negocio:** automática (default) o manual |
| Varios profesionales / roles / invitaciones | Modelo listo (`staff`); **UI post-MVP**. MVP: 1 staff por negocio |
| Pagos y anticipos | Fase posterior. El pago es en el establecimiento |
| Temas visuales | 6 predefinidos, solo perfil público y reserva |
| PWA | Sí, para el dueño |
| Identidad de usuario | Una sola tabla `user`. El rol depende del contexto (dueño de un negocio, cliente de otro) |
| URL pública | `agendo.mx/{slug}` (se mantiene corta; no `/negocio/{slug}`) |
| Panel | `/app/...` |

## 3. Estados de una cita

| Estado | Bloquea horario | Significado |
|---|---|---|
| `pending` | Sí | Espera aprobación del dueño (solo modo manual). Tiene `expires_at` |
| `confirmed` | Sí | Reservación aceptada |
| `completed` | No | Servicio realizado |
| `no_show` | No | El cliente no asistió |
| `cancelled` | No | Cancelada por cliente o negocio |
| `rejected` | No | El dueño rechazó la solicitud |
| `expired` | No | Nadie respondió antes de `expires_at` (lo marca el cron) |

"Bloquea horario" lo impone la base de datos (`appointments_no_overlap`, solo `pending` y `confirmed`), no la UI. Liberar un horario = cambiar el estado; nunca se borran citas.

Transiciones válidas: `pending → confirmed | rejected | expired | cancelled`; `confirmed → completed | no_show | cancelled`. Todo cambio de estado escribe una fila en `appointment_events` (tipo, actor `owner|client|system`, nota operativa opcional; **nunca datos clínicos**).

## 4. Confirmación configurable

| | Automática (default) | Manual |
|---|---|---|
| Estado inicial | `confirmed` | `pending` |
| Bloqueo del horario | Inmediato | Inmediato |
| Aviso al dueño | Sí | Sí (requiere acción) |
| Correo al cliente | Confirmación inmediata | "Solicitud enviada"; confirmación o rechazo después |
| Vencimiento | — | `pending_expiry_hours` (default 24 h, 1–168) → `expired` por cron |

El correo al cliente solo sale si dejó correo; en el flujo manual el link `/cita/{token}` muestra el estado actual.

## 5. Parámetros de reserva por negocio (valores iniciales)

Intervalo de slots 15 min · anticipación mínima 60 min (`booking_lead_time_min`) · ventana 30 días · cancelación por el cliente hasta 4 h antes (`cancellation_min_hours`) · confirmación automática · pago en establecimiento. Todos editables por el dueño salvo el intervalo (fijo en MVP).

## 6. Servicios

Nombre, descripción, duración, precio (o "desde $X" con `price_is_from`), tiempo posterior (`buffer_after_min`), activo, **reservable en línea** (`is_bookable_online`: si es falso el cliente no lo ve, pero el dueño puede agendarlo a mano). Un servicio por cita en el MVP. Nombre y precio se congelan en la cita (`*_snapshot`).

## 7. Cliente final

- Reserva sin cuenta. Link privado `/cita/{public_token}` para ver y cancelar.
- Nunca se vincula una cita a una cuenta solo por un teléfono escrito en un formulario (post-MVP: verificación previa).
- Un teléfono es un cliente distinto en cada negocio (`clients` único por `business_id + phone`); un negocio jamás ve datos de la relación de otro.

## 8. Onboarding del dueño (meta: < 5 min desde un celular)

1. Crear cuenta (nombre, correo, contraseña) y verificar correo.
2. Negocio: nombre, categoría, ciudad/dirección, slug.
3. Primer servicio: nombre, precio, duración.
4. Horario semanal: días, horas, descansos.
5. Publicar: vista previa, link público, QR.

No se piden fotos, tema ni equipo durante el alta; se completan después. `onboarding_completed_at` marca el perfil como completo.

## 9. Notificaciones

MVP, solo correo (Resend): confirmación/solicitud al cliente, aviso al dueño, rechazo, cancelación, recordatorio 24 h antes (cron, idempotente con `reminder_sent_at`). Recordatorio por WhatsApp = botón `wa.me` en el panel. WhatsApp Business API = primera función de pago.

Para categorías de salud, los correos no deben mostrar el nombre del servicio de forma innecesaria.

## 10. Post-MVP (ordenado por prioridad tentativa)

1. Reprogramación nativa desde `/cita/{token}` (se registra en `appointment_events` como `rescheduled`).
2. Varios profesionales en la UI, roles (admin, recepción, profesional) y membresías `business_memberships`.
3. Cuenta de cliente: historial, favoritos, vinculación verificada de citas.
4. Marketplace: `/explorar`, búsqueda, categorías, ubicación, filtros. Publicación con requisitos mínimos (categoría, ubicación válida, servicio activo, disponibilidad).
5. Personalización limitada de color con validación de contraste.
6. WhatsApp Business API, pagos y anticipos, suscripciones.
7. Panel de administración de plataforma (en MVP basta SQL manual).

## 11. Fuera de alcance

Sucursales, varios servicios por cita, atención en línea/a domicilio, reseñas, lealtad, campañas, inventario/POS, expedientes clínicos, apps nativas, integración con calendarios externos.
