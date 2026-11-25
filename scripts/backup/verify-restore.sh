#!/usr/bin/env bash
# Restores a dump into a DISPOSABLE database and checks that it is really usable.
#   TARGET_URL=postgres://... scripts/backup/verify-restore.sh agendomx-production-<ts>.dump
# The manifest (.json next to the dump) must exist. Refuses to touch a database that
# already has tables, so it cannot overwrite anything by mistake.
source "$(dirname "$0")/lib.sh"

dump="${1:?usage: verify-restore.sh <dump>}"
: "${TARGET_URL:?TARGET_URL is required (a disposable, empty database)}"
# Work from the dump's own directory: in Docker mode only $PWD is mounted into the container.
dump="$(cd "$(dirname "$dump")" && pwd)/$(basename "$dump")"
cd "$(dirname "$dump")"
dump="$(basename "$dump")"
manifest="${dump%.dump}.json"
[[ -f "$dump" && -f "$manifest" ]] || die "need both $dump and $manifest"

existing="$(pg psql "$TARGET_URL" -At -v ON_ERROR_STOP=1 -c "select count(*) from information_schema.tables where table_schema in ('public','drizzle')")"
[[ "$existing" == "0" ]] || die "target is not empty ($existing tables): refusing to restore into it"

expected_sha="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).sha256)' "$manifest")"
actual_sha="$(sha256sum "$dump" | cut -d' ' -f1)"
[[ "$expected_sha" == "$actual_sha" ]] || die "checksum mismatch: the dump changed after it was written"

log "restoring $(basename "$dump")"
pg pg_restore --no-owner --no-privileges --exit-on-error --dbname="$TARGET_URL" "$dump"

q() { pg psql "$TARGET_URL" -At -v ON_ERROR_STOP=1 -c "$1"; }
[[ "$(q "select count(*) from pg_extension where extname='btree_gist'")" == "1" ]] || die "btree_gist extension was not restored"
[[ "$(q "select count(*) from pg_constraint where conname='appointments_no_overlap'")" == "1" ]] || die "appointments_no_overlap constraint was not restored"

failures=0
for t in "${BACKUP_TABLES[@]}"; do
  want="$(node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).counts[process.argv[2]]))' "$manifest" "$t")"
  got="$(q "select count(*) from \"$t\"")"
  # Counts were taken just before the dump: allow a small drift for rows written in between.
  slack=$(( want / 20 > 5 ? want / 20 : 5 ))
  if (( got < want - slack || got > want + slack )) || { (( want > 0 )) && (( got == 0 )); }; then
    echo "[backup] MISMATCH $t: manifest $want, restored $got" >&2
    failures=$((failures + 1))
  else
    log "$t: $got rows (manifest $want)"
  fi
done
(( failures == 0 )) || die "$failures table(s) do not match the manifest"
log "restore verified"
