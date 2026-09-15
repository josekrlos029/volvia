#!/usr/bin/env bash
#
# One command from a fresh clone to a running system.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }

step "Dependencias"
pnpm install --frozen-lockfile

if [[ ! -f .env ]]; then
  step "Entorno"
  cp .env.example .env
  echo "  .env creado a partir de .env.example"
fi

step "Infraestructura local"
docker compose -f infra/docker-compose.yml up -d

step "Esperando a Postgres"
for _ in $(seq 1 40); do
  if docker exec volvia-postgres pg_isready -U volvia -d volvia >/dev/null 2>&1; then
    echo "  listo"
    break
  fi
  sleep 1
done

step "Certificados de desarrollo para wallet"
bash infra/scripts/gen-dev-certs.sh

step "Base de datos"
pnpm db:migrate
pnpm db:seed

cat <<'DONE'

✓ Todo listo. Arranca con:

    pnpm dev

  Marketing  http://localhost:3000
  Panel      http://localhost:3001   hola@burger-train.test / volvia-local-2026
  Tarjeta    http://localhost:3002
  API        http://localhost:8080/docs
  Correo     http://localhost:58025

DONE
