#!/usr/bin/env bash
# Dumps a database to <out_dir>/agendomx-<label>-<UTC timestamp>.dump (+ .json manifest).
#   SOURCE_URL=postgres://... scripts/backup/backup.sh production ./out
# Prints the dump path on stdout. Fails (non-zero) if the dump looks wrong.
source "$(dirname "$0")/lib.sh"

label="${1:?usage: backup.sh <label> <out_dir>}"
out_dir="${2:?usage: backup.sh <label> <out_dir>}"
: "${SOURCE_URL:?SOURCE_URL is required}"
[[ "$label" =~ ^[a-z]+$ ]] || die "label must be lowercase letters (got '$label')"

mkdir -p "$out_dir"
cd "$out_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
base="agendomx-$label-$stamp"
dump="$base.dump"

# Counts first, dump second: if rows arrive in between, the restored copy has a few more, never fewer.
counts_sql="select json_build_object($(for t in "${BACKUP_TABLES[@]}"; do printf "'%s', (select count(*) from \"%s\"), " "$t" "$t"; done | sed 's/, $//'))"
counts="$(pg psql "$SOURCE_URL" -At -v ON_ERROR_STOP=1 -c "$counts_sql")"
server_version="$(pg psql "$SOURCE_URL" -At -v ON_ERROR_STOP=1 -c 'show server_version')"

log "dumping $label (server $server_version)"
pg pg_dump "$SOURCE_URL" --format=custom --compress=6 --no-owner --no-privileges --file="$dump"

# Sanity: the archive must be readable and must contain data for every table we count.
size="$(stat -c %s "$dump")"
(( size > 10240 )) || die "dump is suspiciously small ($size bytes)"
toc="$(pg pg_restore --list "$dump")" || die "pg_restore cannot read the dump"
data_entries="$(grep -c 'TABLE DATA' <<<"$toc" || true)"
(( data_entries >= ${#BACKUP_TABLES[@]} )) || die "dump has only $data_entries table data entries"
grep -q 'appointments_no_overlap' <<<"$toc" || die "the no-overlap constraint is missing from the dump"

sha="$(sha256sum "$dump" | cut -d' ' -f1)"
DUMP="$dump" SIZE="$size" SHA="$sha" LABEL="$label" SERVER="$server_version" COUNTS="$counts" \
  node -e 'process.stdout.write(JSON.stringify({ label: process.env.LABEL, createdAt: new Date().toISOString(), serverVersion: process.env.SERVER, dump: process.env.DUMP, sizeBytes: Number(process.env.SIZE), sha256: process.env.SHA, counts: JSON.parse(process.env.COUNTS) }, null, 2) + "\n")' >"$base.json"

log "ok: $dump ($size bytes, sha256 ${sha:0:12}…)"
echo "$PWD/$dump"
