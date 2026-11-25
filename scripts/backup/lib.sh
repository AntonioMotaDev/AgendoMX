#!/usr/bin/env bash
# Shared helpers for the backup scripts. Source this file; do not run it.
set -euo pipefail

log() { echo "[backup] $*" >&2; }
die() { echo "[backup] ERROR: $*" >&2; exit 1; }

# pg <tool> <args...>: runs a Postgres client tool (pg_dump, pg_restore, psql).
# With PG_DOCKER_IMAGE set it runs inside that image (CI uses postgres:19 so the
# client is never older than Neon's server: pg_dump refuses to dump a newer server).
# Otherwise it uses PG_BIN_DIR (optional) or the tool found on PATH.
pg() {
  local tool="$1"
  shift
  if [[ -n "${PG_DOCKER_IMAGE:-}" ]]; then
    docker run --rm --network host -u "$(id -u):$(id -g)" -v "$PWD:$PWD" -w "$PWD" "$PG_DOCKER_IMAGE" "$tool" "$@"
  else
    "${PG_BIN_DIR:+$PG_BIN_DIR/}$tool" "$@"
  fi
}

# Tables whose row counts go in the manifest and are checked after a restore.
BACKUP_TABLES=(user businesses staff services staff_services availability_rules availability_exceptions clients appointments appointment_events)
