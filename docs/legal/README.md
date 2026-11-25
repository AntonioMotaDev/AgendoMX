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
| Nombre, correo, contraseña (hash) | Dueño | Cuenta y acceso | Neon (Postgres) | Solo el dueño y AgendoMX | Mientras exista la cuenta. **No hay borrado de cuenta** |
| Sesión: token, **IP**, agente de usuario, caducidad | Dueño | Mantener la sesión, seguridad | Neon | AgendoMX | Sesión de 30 días; la fila no se borra sola |
| Datos públicos del negocio (nombre, descripción, teléfono, WhatsApp, dirección, redes, logo, portada) | Dueño | Perfil público | Neon; imágenes en Cloudflare R2 | **Público** | Mientras exista |
| Nombre, **celular**, correo opcional | Cliente final | Agendar, contactar y recordar | Neon | El negocio al que pertenece el cliente | Indefinida. **No hay borrado ni anonimización** |
| Cita: fecha/hora, nombre y precio del servicio (copia), estado, link privado (token) | Cliente final | Gestionar la cita | Neon | El negocio; el cliente con su link | Indefinida |
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

## Lo que el producto todavía NO hace (decisiones de producto pendientes)

Los avisos solo prometen lo que existe. Estas brechas hay que cerrarlas o aceptarlas con conocimiento:

1. **Páginas `/privacidad` y `/terminos`:** no existen. El registro ya dice "aceptas los términos y el aviso de privacidad" **sin enlaces** (`copy.auth.register.terms`). Publicar los textos revisados y enlazarlos.
2. **Aviso en el formulario de reserva:** el cliente final hoy no ve ningún aviso al dejar su teléfono. Hay que mostrar la versión corta con enlace al integral, **identificando al negocio como responsable**.
3. **Aceptación de términos del dueño:** no se registra (ni fecha ni versión). Si se exige aceptación expresa, hay que guardarla.
4. **Derechos ARCO / borrado:** no hay función para borrar la cuenta de un dueño ni para borrar o anonimizar clientes. Hoy sería un proceso manual por correo. Decidir un canal (`[CORREO DE PRIVACIDAD]`), un plazo y quién lo ejecuta.
5. **Conservación de clientes y citas:** hoy indefinida. Definir un plazo (p. ej. N años sin actividad) o dejarla al negocio con una herramienta de borrado.
6. **Sesiones:** guardan IP y agente de usuario; no se limpian las vencidas.
7. **Categorías de salud** (psicología, fisioterapia, nutrición, odontología, consultorio médico): el solo hecho de tener una cita puede ser un dato **sensible**. Ya se evita nombrar el servicio en correos y recordatorios, y el producto dice "no es expediente clínico", pero el abogado debe decidir si hace falta **consentimiento expreso** en la reserva **[VERIFICAR]**.
8. **WhatsApp:** los mensajes salen de la cuenta del propio negocio (enlace `wa.me`); AgendoMX no los envía ni los ve. Los avisos lo aclaran.

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
- [ ] Crear `/privacidad` y `/terminos` (hoy son slugs reservados) y enlazarlas en registro, pie del perfil público, correos y formulario de reserva.
- [ ] Mostrar el aviso corto de clientes en el formulario de reserva con el nombre del negocio.
- [ ] Decidir y, si aplica, construir: registro de aceptación, ARCO/borrado, plazo de conservación.
- [ ] Actualizar `copy.auth.register.terms` con enlaces.
