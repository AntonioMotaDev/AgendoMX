#!/usr/bin/env bash
# Reads object keys on stdin, prints the ones that should be deleted.
#   KEEP_DAYS (default 30): backups older than this are expired
#   MIN_KEEP  (default 7):  never expire if that would leave fewer than this many
#   NOW (epoch seconds, tests only)
# Only keys of the exact form <env>/agendomx-<env>-YYYYMMDDTHHMMSSZ.dump are ever
# considered; anything else in the bucket is left alone.
set -euo pipefail
keep_days="${KEEP_DAYS:-30}"
min_keep="${MIN_KEEP:-7}"
now="${NOW:-$(date -u +%s)}"
cutoff=$(( now - keep_days * 86400 ))

mapfile -t keys < <(grep -E '^[a-z]+/agendomx-[a-z]+-[0-9]{8}T[0-9]{6}Z\.dump$' | sort -r || true)  # newest first
total="${#keys[@]}"
(( total > min_keep )) || exit 0

for i in "${!keys[@]}"; do
  (( i >= min_keep )) || continue   # the newest MIN_KEEP are always kept
  stamp="$(sed -E 's/.*-([0-9]{8})T([0-9]{2})([0-9]{2})([0-9]{2})Z\.dump$/\1 \2:\3:\4/' <<<"${keys[$i]}")"
  when="$(date -u -d "$stamp" +%s)"
  (( when < cutoff )) && echo "${keys[$i]}"
done
exit 0
