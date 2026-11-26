#!/usr/bin/env bash
# Резервная копия: база + загрузки + хранилище.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP="${KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M)"

mkdir -p "$BACKUP_DIR"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "→ дамп PostgreSQL"
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
else
  echo "→ копия SQLite"
  [ -f "$APP_DIR/data/reader.db" ] && gzip -c "$APP_DIR/data/reader.db" > "$BACKUP_DIR/db-$STAMP.sqlite.gz"
fi

echo "→ архивирую файлы"
tar czf "$BACKUP_DIR/files-$STAMP.tgz" \
  -C "$APP_DIR" public/uploads data/storage 2>/dev/null || true

echo "→ чищу копии старше $KEEP штук"
ls -1t "$BACKUP_DIR"/db-* 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$BACKUP_DIR"/files-* 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "готово: $BACKUP_DIR"
ls -lh "$BACKUP_DIR" | tail -4
