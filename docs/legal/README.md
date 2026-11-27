# Documentos legales — BORRADOR para revisión de abogado

> **Estado: borrador `0.3-borrador`. No publicar ni mostrar a usuarios sin revisión legal.**
> Lo escribió un asistente de IA a partir de lo que el producto hace *hoy* (verificado en el código) y de una revisión preliminar hecha con otro asistente de IA (ver "Qué se hizo con la revisión previa"). No es asesoría legal. Todo lo marcado **[VERIFICAR]** es una afirmación jurídica que debe confirmar la persona que revise; todo lo entre corchetes `[ASÍ]` es un dato que falta.
>
> **Fuente de la ley (26 nov 2026):** el texto oficial no se pudo abrir desde el entorno de trabajo. Los hechos legales de estos documentos (autoridad, plazos ARCO, elementos del aviso, consentimiento de datos sensibles, remisión vs. transferencia, bloqueo, aviso de vulneraciones) salen de un **resumen no literal** de la LFPDPPP (DOF 20-mar-2025, reforma 14-nov-2025) aportado por el responsable del producto, **sin reglamento**. Siguen como **[VERIFICAR]** solo los puntos que son interpretación o que el resumen no cubre.

## Qué hay aquí

| Archivo | Para quién | Quién es el *responsable* |
|---|---|---|
| `aviso-privacidad-duenos.md` | Personas que crean una cuenta para su negocio | AgendoMX / FORMA/01 |
| `aviso-privacidad-clientes.md` | Clientes finales que agendan una cita (versión corta, casilla de autorización de salud, integral y condiciones) | **El negocio**; AgendoMX actúa como *encargado* |
| `terminos-duenos.md` | Dueños de negocio (incluye el contrato de encargo, Anexo A) | — |

Los tres declaran la **misma versión** (la línea `Versión:` de cada archivo); `pnpm legal:sync` falla si no coinciden. Esa versión es la que se guarda cuando alguien acepta.

## Cómo están repartidos los roles (CLAUDE.md §6)

- **Datos de la cuenta del dueño** (nombre, correo, contraseña, sesiones): AgendoMX es **responsable**.
- **Datos de los clientes de cada negocio** (nombre, celular, correo, citas): el **negocio es el responsable**; AgendoMX es **encargado** y solo trata esos datos por cuenta e instrucciones del negocio. Los términos que acepta el dueño deben decirlo explícitamente (Anexo A).
- Un mismo teléfono es un cliente distinto en cada negocio; ningún negocio ve datos de otro.

## Inventario de datos (verificado en el código)

| Dato | De quién | Para qué | Dónde se guarda | Quién lo ve | Conservación hoy |
|---|---|---|---|---|---|
| Nombre, correo, contraseña (hash) | Dueño | Cuenta y acceso | Neon (Postgres) | Solo el dueño y AgendoMX | Mientras exista la cuenta; el dueño la elimina en **Perfil → Mi cuenta** (o en `/app/cuenta` si no terminó el onboarding) |
| Versión y fecha de los términos aceptados | Dueño | Constancia de aceptación | Neon (`user.terms_version`, `terms_accepted_at`) | AgendoMX | Mientras exista la cuenta |
| Sesión: token, **IP**, agente de usuario, caducidad | Dueño | Mantener la sesión, seguridad | Neon | AgendoMX | 30 días; se borra 1 día después de vencer (cron horario) |
| Datos públicos del negocio (nombre, descripción, teléfono, WhatsApp, dirección, redes, logo, portada) | Dueño | Perfil público | Neon; imágenes en Cloudflare R2 | **Público** | Mientras exista |
| Nombre, **celular**, correo opcional | Cliente final | Agendar, contactar y recordar | Neon | El negocio al que pertenece el cliente | Mientras exista la cuenta del negocio; el negocio puede **borrar los datos de un cliente** (Perfil → Tus clientes) |
| Cita: fecha/hora, nombre y precio del servicio (copia), estado, link privado (token) | Cliente final | Gestionar la cita | Neon | El negocio; el cliente con su link | Igual que el cliente; al borrar sus datos la cita queda sin datos personales y su link se invalida |
| **Constancia del aviso mostrado** (`appointments.privacy_notice_version`) y **autorización de salud** (`health_consent_at`) | Cliente final | Evidencia para el negocio (responsable) | Neon | El negocio, AgendoMX | Con la cita. Solo en reservas públicas hechas mientras los textos están publicados. No contiene datos personales |
| Bitácora de cambios de la cita (tipo, quién, cuándo) | — | Trazabilidad | Neon | El negocio | Con la cita (indefinida mientras exista la cuenta del negocio); sin datos personales |
| Contadores anti-abuso (IP, celular o correo **hasheados**) | Visitantes | Limitar abuso | Neon | AgendoMX | ≤ 1 hora (limpieza horaria) |
| Señales del navegador para Turnstile | Visitantes | Distinguir personas de bots | Cloudflare | Cloudflare | Según Cloudflare |
| Errores de la aplicación (sin cookies, cuerpos, query strings, IP ni correo) | Todos | Detectar fallas | Sentry | AgendoMX | Según Sentry |
| Correos transaccionales (confirmación, recordatorio, avisos) | Clientes y dueños | Notificar | Resend | Resend | Según Resend |
| **Respaldos diarios** de toda la base | Todos | Recuperación ante desastres | Cloudflare R2 (privado) | AgendoMX | **30 días** (mín. 7 copias) |

Cookies: solo la cookie de **sesión** del dueño (estrictamente necesaria). No hay analíticas, publicidad ni rastreadores. Hay una marca en `localStorage` (`agendomx:install-dismissed`) para no repetir el aviso de instalar la app.

Campo `notes_short` de clientes: existe en la base pero **la aplicación no lo usa**; no se menciona en los avisos.

Categorías que el producto trata como **de salud** (`isSensitiveCategory`): fisioterapia, psicología, nutrición, odontología y consulta médica. Para ellas el correo nunca nombra el servicio y la reserva pública pide la casilla de autorización.

## Proveedores y posibles transferencias **[VERIFICAR]**

La clasificación de todos como *encargados* es una hipótesis. Esta matriz es la ficha que hay que completar **proveedor por proveedor** antes de publicar (las celdas `[VERIFICAR]` no se pudieron llenar desde el repositorio):

| Proveedor | Función declarada | Ubicación conocida | Datos a los que puede acceder | Entidad contractual | Subencargados | Contrato / DPA | Incidentes | Fines propios |
|---|---|---|---|---|---|---|---|---|
| Cloudflare | Hosting (Workers), imágenes y respaldos (R2), Turnstile, DNS | Red global; bucket de respaldos `ENAM` | Todo lo que circula por la app y los respaldos; Turnstile: señales del navegador | [VERIFICAR] | [VERIFICAR] | [VERIFICAR] | [VERIFICAR] | **Turnstile: [VERIFICAR]** |
| Neon | Base de datos | AWS `us-east-1` (Estados Unidos) | Toda la base | [VERIFICAR] | [VERIFICAR] (AWS) | [VERIFICAR] | [VERIFICAR] | [VERIFICAR] |
| Resend | Envío de correo | Estados Unidos **[confirmar]** | Correo, nombre y contenido de los mensajes | [VERIFICAR] | [VERIFICAR] | [VERIFICAR] | [VERIFICAR] | [VERIFICAR] |
| Sentry | Monitoreo de errores | Ingesta `us` (Estados Unidos) | Errores sin cookies, cuerpos, query strings, IP ni correo (ver `src/lib/sentry.ts`) | [VERIFICAR] | [VERIFICAR] | [VERIFICAR] | [VERIFICAR] | [VERIFICAR] |
| GitHub | Ejecuta el respaldo diario (los datos pasan por su ejecutor temporal) | Estados Unidos | Volcado de la base durante la ejecución | [VERIFICAR] | [VERIFICAR] (Microsoft/Azure) | [VERIFICAR] | [VERIFICAR] | [VERIFICAR] |

Todos están fuera de México: los avisos los presentan como **proveedores que tratan datos por cuenta** del responsable y piden al abogado decidir si cada caso es *remisión* o *transferencia*, qué leyenda lleva y si exige consentimiento **[VERIFICAR]**.

## Decisiones de producto tomadas y estado

Construidas y **apagadas por la bandera `LEGAL_PUBLISHED`** (hoy encendida solo en staging y en las pruebas E2E; en producción no cambia nada hasta que se publiquen los textos revisados):

| Tema | Decisión | Estado |
|---|---|---|
| Borrado (ARCO) | Todo autoservicio: el dueño elimina su cuenta (Perfil → Mi cuenta, o `/app/cuenta` si no terminó el onboarding, confirmando con el nombre del negocio o el correo) y el negocio borra los datos de un cliente (Perfil → Tus clientes) | **Hecho** |
| Copia de datos | **No hay función de exportar.** Se atiende manualmente por correo (`[CORREO DE PRIVACIDAD]` / `[CORREO DE CONTACTO]`) | Texto actualizado |
| Conservación de clientes y citas | Mientras exista la cuenta del negocio; se borran con la cuenta o a petición. Respaldos: 30 días. No hay periodo de bloqueo (el sistema solo borra) | **Hecho** (revisar con legal si exigen bloqueo o un plazo máximo) |
| Aceptación del dueño | Casilla obligatoria en el registro; se guarda versión y fecha. **Versión nueva:** al volver a entrar, el panel pide aceptar antes de seguir; se puede rechazar eliminando la cuenta (`AcceptTermsGate`) | **Hecho** |
| Aviso en la reserva | Aviso corto con enlace, sin casilla, que nombra al negocio y su domicilio; se guarda `privacy_notice_version` en la cita | **Hecho** |
| Categorías de salud | **No se admiten al lanzar.** Con los textos publicados y `HEALTH_CATEGORIES_ENABLED` apagada: no se ofrecen en onboarding ni en Perfil (un negocio que ya la tiene la conserva), su reserva en línea queda cerrada (perfil sin enlaces, `/reservar` redirige, el servidor rechaza) y el panel lo explica. El flujo de la casilla de autorización y de `health_consent_at` sigue construido y se enciende con `HEALTH_CATEGORIES_ENABLED=true`. El resumen de la ley exige para datos sensibles consentimiento **expreso y escrito** (firma autógrafa, electrónica u otro mecanismo de autenticación): una casilla simple probablemente no basta. El texto de salud (aviso, sección D) no se publica | **Hecho** (apagado por defecto) |
| Aviso en la reserva | El aviso corto se muestra en un recuadro **antes** de pedir los datos (no debajo del botón) y enlaza al integral; contiene los elementos del aviso simplificado (identidad y domicilio del responsable, datos, finalidades, medio para limitar el uso, enlace al integral) | **Hecho** |
| Identidad de AgendoMX | Persona física **Jorge Antonio Mota Villa**, sin RFC por ahora (hoy es gratis y no factura); domicilio Reforma Agraria #640, col. Nuestra Señora de la Salud, San Luis Potosí, S.L.P., C.P. 78398 | Texto actualizado |
| Datos del responsable | Con los textos publicados, un negocio sin domicilio (calle, ciudad y estado) y sin teléfono o WhatsApp **no recibe reservas en línea**; el panel lo avisa y enlaza a Perfil → Información | **Hecho** |
| Correos | Pie con enlace al aviso (el del negocio para clientes, `/privacidad` para el dueño), solo cuando los textos están publicados | **Hecho** |
| Páginas | `/terminos`, `/privacidad` (dueños) y `/{slug}/privacidad` (clientes). Se generan desde `docs/legal/*.md` con `pnpm legal:sync` | **Hecho**, ocultas (404) en producción |
| Limpieza de sesiones | El cron borra sesiones y tokens vencidos hace más de 1 día | **Hecho** |
| Menores | Cláusula provisional: la cita la agenda madre, padre o tutor. El producto no pregunta edad ni verifica nada | Solo texto **[VERIFICAR]** |

Qué hacer cuando legal apruebe: (1) editar los `.md`, quitar todo `[VERIFICAR]`/`[ASÍ]`/"BORRADOR" y subir la versión (los tres a la vez); (2) `pnpm legal:sync`; (3) poner `"LEGAL_PUBLISHED": "true"` en las `vars` de producción de `wrangler.jsonc` (una prueba falla si aún quedan marcadores); (4) las migraciones **0007 y 0008** ya están aplicadas en producción (25 nov 2026; ver abajo), así que solo confirma que no haya migraciones nuevas sin aplicar; (5) desplegar; (6) **conservar copia de la versión publicada** (etiqueta de git o archivo con fecha): el registro de aceptación solo guarda el número de versión.

## Qué se hizo con la revisión previa (otro asistente, 25 nov 2026)

La revisión se tomó como insumo, no como autoridad. Resumen de la decisión por tema:

| Tema de la revisión | Decisión |
|---|---|
| Contraseñas "cifradas" vs. hash | **De acuerdo.** Los textos dicen "función criptográfica de hash"; no se nombra el algoritmo (Better Auth usa su valor por defecto; no se fijó otro en `auth.ts`) |
| "Al usar AgendoMX aceptas ese tratamiento" | **De acuerdo.** Reemplazado por descripción + leyenda de transferencias como **[VERIFICAR]** |
| Consentimiento genérico (§8 aviso de dueños) | **De acuerdo.** Separados puesta a disposición, aceptación contractual y consentimiento solo si la ley lo exige |
| Bloqueo, cancelación y supresión | **De acuerdo en describir lo real:** el sistema borra, no bloquea; los textos lo dicen y lo marcan **[VERIFICAR]** |
| Salud: consentimiento y salvaguardas | **De acuerdo en el riesgo.** Se construyó la casilla de autorización con evidencia, pero el resumen de la ley exige consentimiento expreso y escrito, así que no se admite salud al lanzar |
| Restringir categorías de salud hasta tener respuesta | **Adoptado** (decisión del responsable del producto, 26 nov): sin salud al lanzar, detrás de `HEALTH_CATEGORIES_ENABLED` |
| Domicilio/contacto incompletos → no mostrar aviso incompleto | **De acuerdo.** Sin esos datos el negocio no recibe reservas |
| Enlace de cita confidencial | **De acuerdo.** Reforzado en las condiciones de la reserva |
| Conservación máxima de clientes/citas | **Solo abogado/negocio.** No se inventó un plazo |
| Menores | **Cláusula provisional** (tutor) **[VERIFICAR]** |
| Limitación de responsabilidad | **Solo abogado.** Se dejó el esqueleto sin tope |
| Anexo A (13 puntos) | **De acuerdo.** Ampliado; plazos y frecuencia de auditoría como `[PLAZO]` |
| Casilla de oposición a finalidades no necesarias | **En desacuerdo, y resuelto:** el aviso debe indicar *medios para limitar el uso o divulgación* (resumen, arts. 14–15), no una casilla. Los avisos lo incluyen y no se construyó nada |
| Artículos de la ley (7, 8, 15, 16, 18–36) y plazos de 20 + 15 días | **Verificados contra el resumen de la ley aportado el 26 nov** (no literal, sin reglamento): coinciden 20 y 15 días hábiles, ampliables una vez. Los textos públicos no citan artículos |
| "Todos los proveedores son encargados es una hipótesis" | **De acuerdo.** Matriz por proveedor con celdas por verificar; Turnstile y Sentry señalados |
| Cambios de términos: aceptación verificable | **De acuerdo.** Re-aceptación al volver a entrar (`AcceptTermsGate`) |

## Contraste con el resumen de la ley (26 nov 2026)

| Hecho del resumen | Qué cambió en los textos |
|---|---|
| Autoridad = Secretaría Anticorrupción y Buen Gobierno (SABG); reclamación en 15 días desde la respuesta o el vencimiento | Nombrada en los tres avisos; antes era `[AUTORIDAD]` |
| ARCO: 20 días para comunicar, 15 para ejecutar, ampliables una vez; **hábiles**; gratuito salvo reproducción; repetición en < 12 meses hasta 3 UMA | Plazos y costo en los avisos; la tabla de plazos comerciales usa el máximo legal |
| Aviso integral: identidad y domicilio, datos (identificando sensibles), finalidades (distinguiendo las que requieren consentimiento), medios para limitar uso, medios ARCO, medio de comunicar cambios | Los avisos cumplen cada punto; se agregó el medio para limitar el uso |
| Aviso simplificado (recolección electrónica): identidad, datos, finalidades y medios para limitar uso, más el sitio del integral | El aviso corto lo incluye |
| Consentimiento tácito por regla general; **sensibles: expreso y escrito** | Texto de dueños y clientes lo dice; salud queda fuera del lanzamiento |
| Transferencia = comunicación a un tercero **distinto del encargado** | Proveedores presentados como **remisión**; sigue **[VERIFICAR]** si alguno trata datos para fines propios |
| Cancelación: bloqueo por el plazo de prescripción, luego supresión; excepciones (contrato, ley, etc.) | Los textos admiten que hoy solo se borra; **[VERIFICAR]** si basta |
| Vulneraciones: informar *de inmediato* al titular si afectan significativamente derechos patrimoniales o morales | Anexo A cl. 9 y avisos; plazo máximo de 72 h de AgendoMX al negocio |
| Persona o departamento de datos personales (art. 29) | El propio responsable (Jorge Antonio Mota Villa), dicho en el aviso de dueños |
| Menores, plazo máximo de conservación, contrato de encargo, aviso a la autoridad ante incidentes | **El resumen no los cubre**: siguen **[VERIFICAR]** |

## Marcas que siguen abiertas

- **Datos tuyos (`[ASÍ]`):** ciudad/estado de jurisdicción (propuesta: San Luis Potosí, S.L.P., por confirmar), fecha. Domicilio completo ya puesto (San Luis Potosí, S.L.P., C.P. 78398).
- **Solo interpretación legal (`[VERIFICAR]`):** si el bloqueo previo es obligatorio; plazo máximo de conservación; menores; que el Anexo A sirva como contrato de encargo; si Turnstile/Sentry tratan datos para fines propios; verificación de capacidad del dueño; efecto del bloqueo por versión nueva; redacción de la relación responsable–encargado y de las condiciones de la reserva; validez de la jurisdicción.
- **Limitación de responsabilidad:** esqueleto sin tope (`[Tope de responsabilidad...]`).
- **Solo salud (no publicado):** forma del consentimiento (texto A2 y sección D).

## Lo que sigue pendiente

1. **Efecto del bloqueo por versión nueva en el perfil público:** mientras el dueño no acepte, no entra al panel, pero su perfil sigue recibiendo reservas que no verá. Decisión: sin dueños reales hoy, no se construye nada; se maneja a mano y se revisa con ~20 cuentas. **[VERIFICAR]**
2. **Cliente final y su derecho de acceso:** solo se atiende a través del negocio o por correo (`[CORREO DE PRIVACIDAD]`); no hay pantalla de "descargar mis datos".
3. **Copia de datos del dueño:** manual por correo; no hay exportación.
4. **Consentimiento en citas que el negocio registra por su cuenta** (cita manual, teléfono, WhatsApp): la casilla solo existe en la reserva pública. Los términos lo dejan como obligación del negocio. **[VERIFICAR]**
5. **Cuentas eliminadas y WhatsApp:** los mensajes enviados por `wa.me` salen del WhatsApp del negocio y están fuera de AgendoMX.
6. **Proceso de incidentes:** documentado en `docs/INCIDENTES.md` (72 h al negocio, de inmediato a titulares si la afectación es significativa) con registro en `registro-incidentes.md`. Falta que lo leas y lo hagas tuyo; el aviso a la autoridad sigue **[VERIFICAR]**.
7. **Ficha por proveedor:** plantilla y fichas en `proveedores.md`; falta aceptar y guardar el DPA de cada proveedor y llenar las celdas `[ ]`.
8. **Datos que faltan** (`[ASÍ]`): ver "Marcas que siguen abiertas".
9. **Correos de privacidad y contacto:** creados (`privacidad@` y `contacto@`); verificar que lleguen y que el SPF/Resend no se haya roto.

## Matriz de cumplimiento (obligación → documento → función → evidencia)

| Obligación | Documento | Funcionalidad | Evidencia | Estado |
|---|---|---|---|---|
| Aviso de privacidad (dueños) | `aviso-privacidad-duenos.md` | `/privacidad`, casilla del registro | URL y versión; `user.terms_version` | Construido; texto en borrador |
| Aviso de privacidad (clientes) | `aviso-privacidad-clientes.md` | Aviso corto en la reserva, `/{slug}/privacidad`, enlace en correos y página de cita | `appointments.privacy_notice_version` | Construido; texto en borrador |
| Consentimiento para datos de salud | Aviso de clientes (A2 y D) | Casilla en la reserva pública, refuerzo en el servidor; **apagado** (`HEALTH_CATEGORIES_ENABLED`) | `appointments.health_consent_at` | Construido, no se usa al lanzar; la ley exige consentimiento expreso y escrito **[VERIFICAR]** |
| Aceptación de términos y encargo | `terminos-duenos.md`, Anexo A | Casilla del registro y pantalla de nueva versión | `user.terms_version`, `terms_accepted_at` | Construido; copia de la versión publicada por conservar |
| Derechos ARCO — dueño | Aviso de dueños §6 | Perfil, Mi cuenta, correo | Correos recibidos; sin registro de solicitudes | Parcial: falta registro de solicitudes |
| Derechos ARCO — cliente final | Aviso de clientes §6 | Perfil → Tus clientes (negocio); reenvío por correo | Sin registro de solicitudes | Parcial |
| Cancelación y supresión | Avisos y términos | Eliminar cuenta, borrar cliente, expiración de respaldos | Pruebas de integración; sin bitácora de solicitudes | Borrado sin bloqueo **[VERIFICAR]** |
| Incidentes de seguridad | Anexo A cl. 9 | Runbook `docs/INCIDENTES.md` | `registro-incidentes.md` | Documentado; sin pruebas de simulacro |
| Subencargados | Avisos y Anexo A cl. 6 | `proveedores.md` | Contratos/DPA guardados | **Pendiente:** aceptar y guardar los DPA |
| Identidad del responsable | Los tres | Negocio sin domicilio/contacto no recibe reservas | — | Nombre y domicilio completos; faltan los correos |

## Preguntas para la persona de legal

1. Responsable: persona física (Jorge Antonio Mota Villa) operando bajo el nombre comercial FORMA/01, sin RFC en los textos mientras el servicio sea gratuito. ¿Basta así hasta cobrar? ¿Es suficiente un domicilio de oficina virtual si no se usa el personal?
2. El **reglamento** de la ley de 2025 (el resumen no lo incluye): ¿cambia algo de los plazos, de los requisitos de la solicitud o del aviso? ¿Hay que avisar a la autoridad de una vulneración?
3. ¿Modalidad del aviso para clientes finales (simplificado/corto + integral) y dónde debe mostrarse? ¿Qué elementos mínimos debe llevar el corto?
4. ¿Cómo debe documentarse el **contrato de encargo** entre AgendoMX y cada negocio? ¿Basta aceptar los términos con el Anexo A?
5. Transferencias internacionales y proveedores en EE. UU.: ¿cláusulas, leyendas, consentimiento? ¿Cloudflare Turnstile o Sentry tratan datos para fines propios?
6. Datos sensibles de salud (**no se admiten al lanzar**): ¿qué mecanismo electrónico cumple el consentimiento expreso y escrito (firma electrónica, otro medio de autenticación)? ¿Qué evidencia conservar? ¿Aplica a los cinco rubros? ¿Qué debe hacer el negocio en las citas que no pasan por la reserva pública?
7. Conservación: ¿qué plazo máximo es razonable para citas y clientes? ¿Es necesario un bloqueo antes de suprimir? ¿Y para los respaldos de 30 días respecto a una solicitud de cancelación?
8. Menores de edad: ¿basta la cláusula provisional (agenda madre, padre o tutor) o se requiere algo más?
9. Limitación de responsabilidad, ley aplicable y jurisdicción de los términos.
10. Cambios de términos: ¿basta la re-aceptación al volver a entrar? ¿Qué pasa con el perfil público de quien no acepta?

## Antes de publicar

- [ ] Revisión legal de los tres documentos y llenado de todos los `[ASÍ]`.
- [x] Páginas, aviso en la reserva, casilla y registro de aceptación, ARCO/borrado: construidos (apagados por bandera).
- [x] Enlace al aviso en los correos transaccionales.
- [x] Casilla de autorización para categorías de salud, con evidencia.
- [x] Pantalla de aceptación de versión nueva y borrado de cuenta sin negocio.
- [x] Exigencia de domicilio y contacto para recibir reservas.
- [x] Migraciones 0007 y 0008 aplicadas en producción (25 nov 2026, rama `production` de Neon; también en `staging`). Solo agregan columnas nulas: el código desplegado antes de esta versión sigue funcionando.
- [x] Categorías de salud fuera del lanzamiento (`HEALTH_CATEGORIES_ENABLED` apagada en producción).
- [x] Aviso de privacidad visible antes de pedir los datos en la reserva.
- [x] Runbook de incidentes y plantilla de fichas de proveedores (falta llenarlas).
- [ ] Aceptar y guardar el DPA de cada proveedor.
- [x] Correos `privacidad@agendomx.com` y `contacto@agendomx.com` creados y puestos en los textos (26-27 nov 2026). Falta probar que lleguen y que Resend siga verificado.
- [ ] Confirmar jurisdicción y poner la fecha.
- [ ] Quitar las marcas restantes (ver "Marcas que siguen abiertas") **solo cuando tú o un abogado las resuelvan**.
- [ ] Guardar copia de la versión publicada.
