# Documentos legales — BORRADOR para revisión de abogado

> **Estado: borrador. No publicar ni mostrar a usuarios sin revisión legal.**
> Lo escribió un asistente de IA a partir de lo que el producto hace *hoy* (verificado en el código). No es asesoría legal. Todo lo marcado **[VERIFICAR]** es una afirmación jurídica que debe confirmar la persona que revise; todo lo entre corchetes `[ASÍ]` es un dato que falta.

## Qué hay aquí

| Archivo | Para quién | Quién es el *responsable* |
|---|---|---|
| `aviso-privacidad-duenos.md` | Personas que crean una cuenta para su negocio | AgendoMX / FORMA/01 |
| `aviso-privacidad-clientes.md` | Clientes finales que agendan una cita (versión corta para el formulario + integral) | **El negocio**; AgendoMX actúa como *encargado* |
| `terminos-duenos.md` | Dueños de negocio (incluye el contrato de encargo, Anexo A) | — |

## Cómo están repartidos los roles (CLAUDE.md §6)

- **Datos de la cuenta del dueño** (nombre, correo, contraseña, sesiones): AgendoMX es **responsable**.
- **Datos de los clientes de cada negocio** (nombre, celular, correo, citas): el **negocio es el responsable**; AgendoMX es **encargado** y solo trata esos datos por cuenta e instrucciones del negocio. Los términos que acepta el dueño deben decirlo explícitamente (Anexo A).
- Un mismo teléfono es un cliente distinto en cada negocio; ningún negocio ve datos de otro.

## Inventario de datos (verificado en el código)

| Dato | De quién | Para qué | Dónde se guarda | Quién lo ve | Conservación hoy |
|---|---|---|---|---|---|
| Nombre, correo, contraseña (hash) | Dueño | Cuenta y acceso | Neon (Postgres) | Solo el dueño y AgendoMX | Mientras exista la cuenta; el dueño la elimina en **Perfil → Mi cuenta** |
| Sesión: token, **IP**, agente de usuario, caducidad | Dueño | Mantener la sesión, seguridad | Neon | AgendoMX | 30 días; se borra 1 día después de vencer (cron horario) |
| Datos públicos del negocio (nombre, descripción, teléfono, WhatsApp, dirección, redes, logo, portada) | Dueño | Perfil público | Neon; imágenes en Cloudflare R2 | **Público** | Mientras exista |
| Nombre, **celular**, correo opcional | Cliente final | Agendar, contactar y recordar | Neon | El negocio al que pertenece el cliente | Mientras exista la cuenta del negocio; el negocio puede **borrar los datos de un cliente** (Perfil → Tus clientes) |
| Cita: fecha/hora, nombre y precio del servicio (copia), estado, link privado (token) | Cliente final | Gestionar la cita | Neon | El negocio; el cliente con su link | Igual que el cliente; al borrar sus datos la cita queda sin datos personales y su link se invalida |
| Bitácora de cambios de la cita (tipo, quién, cuándo) | — | Trazabilidad | Neon | El negocio | Indefinida |
| Contadores anti-abuso (IP, celular o correo **hasheados**) | Visitantes | Limitar abuso | Neon | AgendoMX | ≤ 1 hora (limpieza horaria) |
| Señales del navegador para Turnstile | Visitantes | Distinguir personas de bots | Cloudflare | Cloudflare | Según Cloudflare |
| Errores de la aplicación (sin cookies, cuerpos, query strings, IP ni correo) | Todos | Detectar fallas | Sentry | AgendoMX | Según Sentry |
| Correos transaccionales (confirmación, recordatorio, avisos) | Clientes y dueños | Notificar | Resend | Resend | Según Resend |
| **Respaldos diarios** de toda la base | Todos | Recuperación ante desastres | Cloudflare R2 (privado) | AgendoMX | **30 días** (mín. 7 copias) |

Cookies: solo la cookie de **sesión** del dueño (estrictamente necesaria). No hay analíticas, publicidad ni rastreadores. Hay una marca en `localStorage` (`agendomx:install-dismissed`) para no repetir el aviso de instalar la app.

Campo `notes_short` de clientes: existe en la base pero **la aplicación no lo usa**; no se menciona en los avisos.

## Proveedores y posibles transferencias **[VERIFICAR]**

| Proveedor | Función | Ubicación conocida |
|---|---|---|
| Cloudflare | Hosting (Workers), imágenes y respaldos (R2), Turnstile, DNS | Red global; bucket de respaldos `ENAM` (este de Norteamérica) |
| Neon | Base de datos | AWS `us-east-1` (Estados Unidos) |
| Resend | Envío de correo | Estados Unidos **[confirmar]** |
| Sentry | Monitoreo de errores | Ingesta `us` (Estados Unidos) |
| GitHub | Ejecuta el respaldo diario (los datos pasan por su ejecutor temporal) | Estados Unidos |

Todos están fuera de México: los avisos los presentan como **encargados/proveedores de servicios**, y el abogado debe decidir si cada caso requiere tratarse como *transferencia* o *remisión* y qué leyenda llevar **[VERIFICAR]**.

## Decisiones de producto tomadas y estado

Decididas con el responsable del producto y ya construidas **apagadas por la bandera `LEGAL_PUBLISHED`** (hoy encendida solo en staging y en las pruebas E2E; en producción no cambia nada hasta que se publiquen los textos revisados):

| Tema | Decisión | Estado |
|---|---|---|
| Borrado (ARCO) | Todo autoservicio: el dueño elimina su cuenta (Perfil → Mi cuenta, confirmando con el nombre del negocio) y el negocio borra los datos de un cliente (Perfil → Tus clientes) | **Hecho** |
| Conservación de clientes y citas | Mientras exista la cuenta del negocio; se borran con la cuenta o a petición. Respaldos: 30 días | **Hecho** (revisar con legal si exigen un plazo máximo) |
| Aceptación | Casilla obligatoria en el registro; se guarda versión y fecha (`user.terms_version`, `user.terms_accepted_at`). En la reserva: aviso corto con enlace, sin casilla | **Hecho** |
| Páginas | `/terminos`, `/privacidad` (dueños) y `/{slug}/privacidad` (clientes; nombra al negocio como responsable). Se generan desde `docs/legal/*.md` con `pnpm legal:sync` | **Hecho**, ocultas (404) en producción |
| Limpieza de sesiones | El cron borra sesiones y tokens vencidos hace más de 1 día | **Hecho** |

Qué hacer cuando legal apruebe: (1) editar los `.md`, quitar todo `[VERIFICAR]`/`[ASÍ]`/"BORRADOR" y subir la versión; (2) `pnpm legal:sync`; (3) poner `"LEGAL_PUBLISHED": "true"` en las `vars` de producción de `wrangler.jsonc` (una prueba falla si aún quedan marcadores); (4) aplicar la migración 0007 en producción **antes** de desplegar; (5) desplegar.

## Lo que sigue pendiente

1. **Cuentas existentes:** el dueño que ya tiene cuenta no aceptó la versión nueva (`terms_version` nulo). Decidir si se le pide aceptarla al volver a entrar.
2. **Dueños sin negocio** (no terminaron el onboarding): no ven Perfil, así que no tienen el botón de eliminar cuenta. Hoy sería manual por correo.
3. **Cliente final y su derecho de acceso:** solo se atiende a través del negocio o por correo (`[CORREO DE PRIVACIDAD]`); no hay pantalla de "descargar mis datos".
4. **Correos transaccionales:** no llevan enlace al aviso de privacidad.
5. **Categorías de salud:** falta la decisión de legal sobre consentimiento expreso (la casilla solo para esas categorías es un cambio pequeño).
6. **Cuentas eliminadas y WhatsApp:** los mensajes enviados por `wa.me` salen del WhatsApp del negocio y están fuera de AgendoMX.

## Preguntas para la persona de legal

1. Datos de identificación de AgendoMX: razón social, RFC, domicilio, correo de privacidad **[ASÍ]**. ¿Quién es el responsable: FORMA/01 como persona física o moral?
2. Marco aplicable a abril 2026: ley de 2025 y su reglamento, **autoridad competente** (el borrador asume que sustituyó al INAI) y plazos de los derechos ARCO **[VERIFICAR]**.
3. ¿Modalidad del aviso para clientes finales (simplificado/corto + integral) y dónde debe mostrarse?
4. ¿Cómo debe documentarse el **contrato de encargo** entre AgendoMX y cada negocio? ¿Basta aceptar los términos con el Anexo A?
5. Transferencias internacionales y proveedores en EE. UU.: ¿cláusulas, leyendas, consentimiento?
6. Datos sensibles de salud en las categorías mencionadas: ¿consentimiento expreso? ¿Debe AgendoMX restringir esas categorías o pedir cláusulas adicionales al negocio?
7. Conservación: ¿qué plazo máximo es razonable para citas y clientes? ¿Y para los respaldos de 30 días respecto a una solicitud de cancelación?
8. Menores de edad: el producto no los excluye. ¿Hace falta una cláusula (p. ej. las citas de menores las agenda el padre/tutor)?
9. Limitación de responsabilidad, ley aplicable y jurisdicción de los términos.
10. Aviso en el correo transaccional (pie de página con enlace al aviso).

## Antes de publicar

- [ ] Revisión legal de los tres documentos y llenado de todos los `[ASÍ]`.
- [x] Páginas, aviso en la reserva, casilla y registro de aceptación, ARCO/borrado: construidos (apagados por bandera).
- [ ] Enlazar el aviso en los correos transaccionales (decisión pendiente).
