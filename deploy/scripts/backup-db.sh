#!/usr/bin/env bash
# Nightly MySQL backup (gzip), keeping the last 14 days. Install with:
#   (crontab -l 2>/dev/null; echo "30 2 * * * $HOME/kirana/deploy/scripts/backup-db.sh >> $HOME/kirana-backups/backup.log 2>&1") | crontab -
set -euo pipefail
cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-$HOME/kirana-backups}"
mkdir -p "$BACKUP_DIR"
stamp=$(date -u +%Y%m%d-%H%M%S)
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T mysql \
  sh -c 'mysqldump --single-transaction --routines --triggers -uroot -p"$MYSQL_ROOT_PASSWORD" kirana' \
  | gzip > "$BACKUP_DIR/kirana-$stamp.sql.gz"
# Product images live in the "media" volume
docker run --rm -v kirana-prod_media:/media -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/media-$stamp.tar.gz" -C /media .
find "$BACKUP_DIR" -name 'kirana-*.sql.gz' -mtime +14 -delete
find "$BACKUP_DIR" -name 'media-*.tar.gz' -mtime +14 -delete
echo "$(date -u) backup ok: kirana-$stamp.sql.gz"
