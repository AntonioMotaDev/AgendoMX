# Fichas de proveedores (encargados / subencargados)

> Documento interno, no se publica. Sirve de evidencia de qué hace cada proveedor con los datos y bajo qué contrato. Llénalo con lo que **tú** verifiques en cada proveedor; lo que no esté verificado se queda en `[ ]`.

## Cómo llenar una ficha

1. **Contrato de tratamiento de datos.** Busca en el sitio o el panel del proveedor el *Data Processing Addendum* (DPA) o "Términos de tratamiento de datos". Si se acepta dentro del panel, acéptalo y guarda un **PDF con la fecha**. Anota la versión.
2. **Lista de subencargados.** Cada proveedor publica sus propios subencargados (*subprocessors*). Guarda copia con fecha.
3. **Región.** Anota dónde se procesan y guardan los datos, y si puedes elegirla (hoy: Neon `us-east-1`, R2 `ENAM`, Sentry `us`).
4. **Qué datos puede ver.** Con base en el inventario del `README.md`.
5. **Incidentes.** ¿En cuántas horas se compromete a avisarte? Debe ser menor a las 72 h que tú prometes a tus clientes.
6. **Retención y borrado.** ¿Cuánto tiempo guarda los datos y cómo se borran al cancelar?
7. **¿Encargado o responsable?** Es **encargado** si trata los datos solo por tus instrucciones y para prestarte el servicio. Si el DPA dice que también los usa para fines propios (analítica, mejora de producto), para ese uso no es tu encargado: anótalo y llévalo al abogado.
8. **Certificaciones** que publique (SOC 2, ISO 27001): sirven como evidencia de medidas de seguridad.

## Plantilla

```
### <Proveedor>
- Función: 
- Entidad contractual (razón social del proveedor): [ ]
- Datos a los que puede acceder: 
- Región / ubicación: 
- DPA aceptado el: [ ]   Versión: [ ]   Copia guardada en: [ ]
- Subencargados (copia del: [ ]): 
- Aviso de incidentes en: [ ] horas
- Retención y borrado: [ ]
- ¿Usa los datos para fines propios?: [ ]
- Certificaciones: [ ]
- Revisada por / fecha: [ ]
```

## Fichas

### Cloudflare
- Función: alojamiento (Workers), imágenes y respaldos (R2), Turnstile anti-bots, DNS.
- Datos: todo lo que circula por la app; respaldos completos de la base; Turnstile ve señales del navegador de quien reserva.
- Región: red global; respaldos en `ENAM`.
- **Punto a verificar:** el uso de los datos de Turnstile por parte de Cloudflare para sus propios fines.
- Entidad contractual / DPA / subencargados / incidentes / retención / certificaciones: `[ ]`

### Neon
- Función: base de datos (Postgres).
- Datos: toda la base (cuentas, clientes, citas).
- Región: AWS `us-east-1`.
- Entidad contractual / DPA / subencargados (AWS) / incidentes / retención / certificaciones: `[ ]`

### Resend
- Función: envío de correos transaccionales (verificación, avisos, confirmaciones, recordatorios).
- Datos: correo, nombre y contenido de cada mensaje.
- Región: Estados Unidos `[confirmar]`.
- Entidad contractual / DPA / subencargados / incidentes / retención de contenido y logs / certificaciones: `[ ]`

### Sentry
- Función: monitoreo de errores.
- Datos: errores sin cookies, cuerpos, query strings, IP ni correo (ver `src/lib/sentry.ts`).
- Región: ingesta `us`.
- **Punto a verificar:** que no use los datos para fines propios y que lo enviado sea realmente anónimo.
- Entidad contractual / DPA / subencargados / incidentes / retención / certificaciones: `[ ]`

### GitHub
- Función: ejecuta el respaldo diario; el volcado de la base pasa por su ejecutor temporal.
- Datos: el volcado completo, solo durante la ejecución.
- Región: Estados Unidos.
- Entidad contractual / DPA / subencargados / incidentes / retención de logs del workflow / certificaciones: `[ ]`
