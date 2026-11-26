# Runbook: incidente de seguridad (1 página)

**Qué cuenta como incidente:** acceso, pérdida, alteración o uso no autorizado de datos personales (cuentas de dueños, o nombres, celulares, correos y citas de clientes), o la sospecha fundada de que pasó. Si dudas, trátalo como incidente y descártalo después.

**Reloj:** `T0` = el momento en que **confirmas** que hay una vulneración (anótalo con fecha y hora). Compromisos públicos: avisar a los negocios afectados **a más tardar 72 h desde T0** (Anexo A, cl. 9) y a los titulares afectados **de inmediato** cuando la vulneración afecte significativamente sus derechos patrimoniales o morales (según el resumen de la LFPDPPP, art. 19; confirmar con el texto oficial y el reglamento).

## 1. Detectar
Alerta de Sentry, anomalías en Workers Logs, correo a `privacidad@`, reporte de un usuario, aviso de un proveedor (Cloudflare, Neon, Resend, Sentry, GitHub) o actividad rara en la base (picos en `rate_limits`, sesiones desconocidas). Abre una fila en `docs/legal/registro-incidentes.md` desde el primer minuto.

## 2. Contener (primeras horas)
- **Preserva evidencia antes de cambiar nada:** exporta logs de Workers y el issue de Sentry; crea un *snapshot* de la rama de Neon afectada. No borres nada.
- **Secreto filtrado → rotarlo:** `BETTER_AUTH_SECRET` (cierra todas las sesiones y cambia el token del cron), contraseña de la base en Neon (y actualizar la configuración de Hyperdrive), llaves de R2 y de GitHub Actions, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`. Después redespliega.
- **Cuentas comprometidas:** borra sus filas de `session` y obliga a restablecer contraseña.
- **Código vulnerable:** vuelve al despliegue anterior (Cloudflare → Workers → Deployments → Rollback) o despliega el arreglo. Si hay que parar todo, desactiva la ruta del Worker en Cloudflare (la app queda fuera de línea).

## 3. Evaluar (dentro de las primeras 24 h)
Responde por escrito: ¿qué datos? ¿de cuántas personas y de qué negocios? ¿hay datos sensibles (hoy no se recaban)? ¿desde cuándo y cómo? ¿sigue ocurriendo? ¿afecta *significativamente* derechos patrimoniales o morales (contraseñas con hash, teléfonos, correos, citas)? Usa la base y los logs; separa lo **comprobado** de lo **supuesto**.

## 4. Avisar
- **Negocios afectados** (son los responsables de los datos de sus clientes): correo, máximo 72 h desde `T0`. Contenido: qué pasó y cuándo, qué datos y de cuántos clientes, qué ya hiciste, qué deben hacer ellos (informar de inmediato a sus clientes si hay afectación significativa) y cómo contactarte.
- **Dueños** (aquí AgendoMX es el responsable): de inmediato si la afectación es significativa, con el mismo contenido y qué hacer (cambiar contraseña, desconfiar de correos sospechosos).
- **Proveedor** si el origen es suyo. **Autoridad:** el resumen de la ley que tenemos no prevé avisarle; confirmar con el texto oficial y el reglamento. **[VERIFICAR]**

## 5. Recuperar y cerrar
Corrige la causa, verifica que no persista, restaura datos si hace falta (ver `docs/BACKUPS.md`) y confirma la rotación de secretos. **Post-mortem dentro de 7 días:** causa raíz, qué falló en la detección, qué cambia (código, alertas, este runbook).

## 6. Registrar
Cada incidente, incluso los descartados, va en `docs/legal/registro-incidentes.md`: fecha y hora de detección y de `T0`, descripción, datos y personas afectadas, acciones, a quién y cuándo se avisó, causa raíz y cierre. Es tu evidencia de que cumpliste tus plazos.
