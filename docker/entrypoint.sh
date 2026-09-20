#!/bin/sh
set -e

echo "Aguardando MySQL em ${MYSQL_HOST:-mysql}:${MYSQL_PORT:-3306}..."
until nc -z "${MYSQL_HOST:-mysql}" "${MYSQL_PORT:-3306}"; do
  sleep 1
done

echo "Aplicando migrations..."
npx prisma migrate deploy

echo "Executando seed..."
node dist/seed.js

echo "Iniciando API..."
exec node dist/main.js
