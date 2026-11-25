# Respaldos y restauración

Qué hay: un `pg_dump` diario de Neon a un bucket **privado** de R2 (`agendomx-backups`), con una prueba de restauración en cada corrida. Lo corre `.github/workflows/backup.yml`; la lógica vive en `scripts/backup/` (con pruebas).

## Cómo funciona

1. `backup.sh` hace `pg_dump --format=custom` con el cliente de **Postgres 19** (imagen `postgres:19`: un cliente más viejo que el servidor de Neon se niega a respaldar) y escribe `agendomx-<env>-<UTC>.dump` + un `.json` con tamaño, SHA-256 y conteo de filas por tabla.
2. Sube ambos a `s3://agendomx-backups/<env>/` y compara el tamaño remoto.
3. **Descarga de vuelta lo que subió** y lo restaura en un Postgres 19 efímero (`verify-restore.sh`): checksum, extensión `btree_gist`, constraint `appointments_no_overlap` y conteos contra el manifest. Si algo falla, el workflow falla y **no se borra nada**.
4. Solo entonces aplica la retención: se borran copias de más de 30 días, siempre conservando las 7 más recientes (`retention.sh`; solo toca claves con el formato exacto de un respaldo).

Un respaldo que nunca se restauró no es un respaldo: por eso el paso 3 corre todos los días.

## Configuración (una sola vez)

Secrets de GitHub (Settings → Secrets and variables → Actions):

| Secret | Qué es |
|---|---|
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare → R2 → *Manage R2 API Tokens* → Create → permiso **Object Read & Write**, limitado **solo al bucket `agendomx-backups`**. |
| `DATABASE_URL_PRODUCTION` | Neon → rama `production` → Connection string, **sin pooler** (el host no debe llevar `-pooler`; pg_dump no funciona bien por PgBouncer). |
| `DATABASE_URL_STAGING` | Igual, rama `staging` (opcional; solo si quieres respaldar staging). |

`CLOUDFLARE_ACCOUNT_ID` ya existe (lo usa el deploy).

Endurecimiento recomendado: en vez de la cadena del dueño de la base, crea un rol de solo lectura en Neon y usa su cadena:

```sql
CREATE ROLE backup_ro LOGIN PASSWORD '<contraseña larga>';
GRANT pg_read_all_data TO backup_ro;
```

Si ese secret se filtra, solo se pueden *leer* datos, no modificarlos.

## Primera corrida

Actions → **Backup** → *Run workflow* → `production`. Debe terminar en verde con "Restore check: passed" en el resumen. El horario diario (08:17 UTC) solo corre cuando este archivo está en la rama por defecto (`main`).

## Restaurar (emergencia)

Siempre restaura en una base **nueva**, nunca encima de la de producción.

```bash
# 1. Baja el respaldo y su manifest (R2 → Manage R2 API Tokens; o la consola web)
aws s3 cp s3://agendomx-backups/production/agendomx-production-<fecha>.dump . --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
aws s3 cp s3://agendomx-backups/production/agendomx-production-<fecha>.json . --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# 2. Crea una rama nueva en Neon y copia su cadena de conexión (sin pooler).
# 3. Restaura y verifica (cliente Postgres 19):
PG_DOCKER_IMAGE=postgres:19 TARGET_URL='postgres://…nueva-rama…' scripts/backup/verify-restore.sh agendomx-production-<fecha>.dump
```

Para volver a servir tráfico: apunta la configuración de Hyperdrive (`agendomx` / `agendomx-staging`) a la nueva rama, o promuévela en Neon. Después revisa `/api/health`.

## Límites conocidos

- **Los respaldos contienen datos personales** (nombres, teléfonos, correos de clientes). El bucket es privado y R2 cifra en reposo; no hay cifrado adicional con llave propia (perderla dejaría los respaldos inservibles). El aviso de privacidad debe mencionar la retención de 30 días.
- Un respaldo diario puede perder hasta 24 h de citas. Neon además conserva historial de la rama para restaurar a un punto en el tiempo (ventana de su plan): úsalo primero si el problema es reciente.
- GitHub desactiva los workflows programados tras 60 días sin actividad en el repositorio, y avisa por correo cuando falla una corrida, pero no cuando deja de correr: revisa de vez en cuando que haya una corrida reciente.
