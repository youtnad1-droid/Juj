#!/usr/bin/env bash
# Preview-only: starts a local MariaDB (installing it if missing) and loads database/juj.sql on first run.
set -e
cd "$(dirname "$0")/.."
set -a; source ./.env; set +a
DATA=/root/mysql-data
SOCK=/tmp/juj-mysql.sock
if ! command -v mariadbd >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y mariadb-server mariadb-client >/tmp/mariadb_install.log 2>&1
fi
if [ ! -d "$DATA/mysql" ]; then
  mkdir -p "$DATA"
  mariadb-install-db --user=root --datadir="$DATA" --auth-root-authentication-method=socket >/tmp/mariadb_init.log 2>&1
fi
if ! mariadb-admin --socket="$SOCK" ping >/dev/null 2>&1; then
  (mariadbd --user=root --datadir="$DATA" --socket="$SOCK" --port="$DB_PORT" --bind-address=127.0.0.1 \
    --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci >/tmp/mariadb.log 2>&1 &)
  for _ in $(seq 1 30); do mariadb-admin --socket="$SOCK" ping >/dev/null 2>&1 && break; sleep 1; done
fi
mariadb --socket="$SOCK" -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL
if [ -z "$(mariadb --socket="$SOCK" -uroot -N -e "SHOW TABLES FROM \`$DB_NAME\` LIKE 'users'")" ]; then
  mariadb --socket="$SOCK" -uroot "$DB_NAME" < database/juj.sql
  echo "[dev-db] loaded database/juj.sql"
fi
echo "[dev-db] MariaDB ready on 127.0.0.1:$DB_PORT"
