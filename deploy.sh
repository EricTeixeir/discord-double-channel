#!/usr/bin/env bash
# Deploy na VPS: atualiza o código e reconstrói o container.
# Uso: ./deploy.sh (na pasta do projeto)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERRO: .env não encontrado — crie a partir do .env.example antes de fazer deploy." >&2
  exit 1
fi

if [ -d .git ]; then
  echo "==> git pull"
  git pull --ff-only
else
  echo "==> sem repositório git aqui, usando os arquivos como estão"
fi

echo "==> rebuild + restart"
docker compose up -d --build

echo "==> status"
docker compose ps

echo "==> últimos logs (Ctrl+C para sair)"
docker compose logs --tail=20 csbot
