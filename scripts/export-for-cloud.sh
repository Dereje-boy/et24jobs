#!/usr/bin/env bash
#
# export-for-cloud.sh
#
# One-time snapshot export of the local MySQL database, meant to be imported
# into a hosted MySQL server. This is NOT replication: it produces a single
# .sql file and stops there. It never connects to the cloud server.
#
# Tables are exported one at a time in foreign-key-safe order so the file can
# be replayed top to bottom:
#
#     categories -> jobs -> job_attachments
#     admin, scholarships, internships  (independent)
#     sessions                          (skipped by default)
#
# Usage:
#   LOCAL_DB=etjobs ./scripts/export-for-cloud.sh
#
#   # also copy throwaway express-session rows
#   LOCAL_DB=etjobs INCLUDE_SESSIONS=1 ./scripts/export-for-cloud.sh
#
#   # the printed import command needs these; none are contacted by this script
#   CLOUD_HOST=... CLOUD_USER=... CLOUD_DB=... ./scripts/export-for-cloud.sh
#
# Requires: mysqldump + mysql from the local Laragon MySQL install.

set -euo pipefail

# --------------------------------------------------------------------------
# Configuration (override any of these through the environment)
# --------------------------------------------------------------------------

MYSQL_BIN="${MYSQL_BIN:-/c/laragon/bin/mysql/mysql-8.4.3-winx64/bin}"

LOCAL_HOST="${LOCAL_HOST:-127.0.0.1}"   # 127.0.0.1 forces TCP; "localhost" can
LOCAL_PORT="${LOCAL_PORT:-3306}"        # hit named-pipe issues in Git Bash
LOCAL_USER="${LOCAL_USER:-root}"
LOCAL_DB="${LOCAL_DB:-}"
LOCAL_PASSWORD="${LOCAL_PASSWORD:-}"

OUT_DIR="${OUT_DIR:-./backups}"
INCLUDE_SESSIONS="${INCLUDE_SESSIONS:-0}"

# Used only to print the import command at the end.
CLOUD_HOST="${CLOUD_HOST:-<cloud-host>}"
CLOUD_PORT="${CLOUD_PORT:-3306}"
CLOUD_USER="${CLOUD_USER:-<cloud-user>}"
CLOUD_DB="${CLOUD_DB:-<cloud-db-name>}"
CLOUD_SSL_MODE="${CLOUD_SSL_MODE:-REQUIRED}"

DUMP_BIN="$MYSQL_BIN/mysqldump.exe"
CLIENT_BIN="$MYSQL_BIN/mysql.exe"

# --------------------------------------------------------------------------
# Pre-flight checks
# --------------------------------------------------------------------------

if [[ -z "$LOCAL_DB" ]]; then
    echo "error: LOCAL_DB is required (e.g. LOCAL_DB=etjobs $0)" >&2
    exit 1
fi

for bin in "$DUMP_BIN" "$CLIENT_BIN"; do
    if [[ ! -f "$bin" ]]; then
        echo "error: not found: $bin" >&2
        echo "       set MYSQL_BIN to the folder containing mysqldump.exe" >&2
        exit 1
    fi
done

# Prompt once instead of seven times, and keep the password out of argv.
# MYSQL_PWD is read by the MySQL clients from the environment.
if [[ -z "$LOCAL_PASSWORD" ]]; then
    read -rsp "MySQL password for ${LOCAL_USER}@${LOCAL_HOST}: " LOCAL_PASSWORD
    echo
fi
export MYSQL_PWD="$LOCAL_PASSWORD"

# --------------------------------------------------------------------------
# Import order
# --------------------------------------------------------------------------
# Parent tables before children: categoryId (jobs, internships) and jobId
# (job_attachments) must exist first. FOREIGN_KEY_CHECKS=0 is emitted in the
# file header as a belt-and-braces measure, but the order alone is valid.

ORDER=(
    admin
    categories
    jobs
    job_attachments
    scholarships
    internships
    sessions
)

TABLES=()
for table in "${ORDER[@]}"; do
    if [[ "$table" == "sessions" && "$INCLUDE_SESSIONS" != "1" ]]; then
        continue
    fi
    TABLES+=("$table")
done

# --------------------------------------------------------------------------
# Export
# --------------------------------------------------------------------------

mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="$OUT_DIR/${LOCAL_DB}_${STAMP}.sql"

{
    echo "-- Snapshot of \`${LOCAL_DB}\` exported $(date '+%Y-%m-%d %H:%M:%S')"
    echo "-- Source: ${LOCAL_USER}@${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DB}"
    echo "-- Target: ${CLOUD_HOST}:${CLOUD_PORT}/${CLOUD_DB}"
    echo "-- Import order: ${TABLES[*]}"
    echo "--"
    echo "-- One-time snapshot, not replication. Re-running the import replaces"
    echo "-- these tables (DROP TABLE IF EXISTS precedes each CREATE TABLE)."
    echo
    echo "SET NAMES utf8mb4;"
    echo "SET FOREIGN_KEY_CHECKS=0;"
    echo "SET UNIQUE_CHECKS=0;"
    echo
} > "$DUMP_FILE"

echo "Exporting ${LOCAL_DB} -> ${DUMP_FILE}"

for table in "${TABLES[@]}"; do
    printf '  %-18s ' "$table"

    # --single-transaction here gives a consistent read per table, not across
    # the whole set. The app DB is small; stop the dev server if you need
    # cross-table consistency.
    if "$DUMP_BIN" \
        -h "$LOCAL_HOST" \
        -P "$LOCAL_PORT" \
        -u "$LOCAL_USER" \
        --single-transaction \
        --quick \
        --no-tablespaces \
        --set-gtid-purged=OFF \
        --default-character-set=utf8mb4 \
        --hex-blob \
        --triggers \
        --skip-comments \
        --add-drop-table \
        "$LOCAL_DB" "$table" >> "$DUMP_FILE"
    then
        echo "ok"
    else
        echo "FAILED" >&2
        echo "error: mysqldump failed for table '$table'; partial file left at $DUMP_FILE" >&2
        exit 1
    fi

    echo >> "$DUMP_FILE"
done

{
    echo "SET UNIQUE_CHECKS=1;"
    echo "SET FOREIGN_KEY_CHECKS=1;"
} >> "$DUMP_FILE"

# --------------------------------------------------------------------------
# Sanity check
# --------------------------------------------------------------------------

EXPECTED=${#TABLES[@]}
FOUND="$(grep -c "CREATE TABLE" "$DUMP_FILE" || true)"
SIZE="$(ls -lh "$DUMP_FILE" | awk '{print $5}')"

echo
echo "Wrote   : $DUMP_FILE"
echo "Size    : $SIZE"
echo "Tables  : $FOUND/$EXPECTED"

if [[ "$FOUND" -ne "$EXPECTED" ]]; then
    echo "warning: expected $EXPECTED CREATE TABLE statements, found $FOUND." >&2
    echo "         Inspect the file before importing it." >&2
else
    echo "Header  : OK (FOREIGN_KEY_CHECKS=0 opened, =1 closed)"
fi

if [[ "$INCLUDE_SESSIONS" != "1" ]]; then
    echo "Skipped : sessions (set INCLUDE_SESSIONS=1 to include)"
fi

# --------------------------------------------------------------------------
# Import command (printed, never executed)
# --------------------------------------------------------------------------

cat <<EOF

------------------------------------------------------------------
Import into the cloud server (run this yourself):

  "${CLIENT_BIN}" \\
    -h "${CLOUD_HOST}" \\
    -P "${CLOUD_PORT}" \\
    -u "${CLOUD_USER}" \\
    -p \\
    --ssl-mode=${CLOUD_SSL_MODE} \\
    --default-character-set=utf8mb4 \\
    "${CLOUD_DB}" < "${DUMP_FILE}"

Before that: the database must already exist on the host, your IP must be
allowlisted, and CLOUD_SSL_MODE must match the provider (some have no TLS:
use --ssl-mode=DISABLED there).

Verify afterwards on BOTH servers:

  SELECT 'admin' AS t, COUNT(*) n FROM admin
  UNION ALL SELECT 'categories', COUNT(*) FROM categories
  UNION ALL SELECT 'jobs', COUNT(*) FROM jobs
  UNION ALL SELECT 'job_attachments', COUNT(*) FROM job_attachments
  UNION ALL SELECT 'scholarships', COUNT(*) FROM scholarships
  UNION ALL SELECT 'internships', COUNT(*) FROM internships;

------------------------------------------------------------------
EOF
