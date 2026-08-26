#!/usr/bin/env bash
# Idempotent bootstrap for the DeNote development environment.
# Installs Node dependencies, a local MongoDB server, and seeds a local
# backend config.env (no cloud secrets required for local development).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Installing backend dependencies"
npm install

echo "==> Installing frontend dependencies"
(cd frontend && npm install)

if ! command -v mongod >/dev/null 2>&1; then
  echo "==> Installing MongoDB Community Server"
  curl -fsSL https://pgp.mongodb.com/server-8.0.asc | \
    sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor --yes
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | \
    sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y mongodb-org
else
  echo "==> MongoDB already installed, skipping"
fi

sudo mkdir -p /data/db
sudo chown -R "$(whoami)" /data/db

if [ ! -f config.env ]; then
  echo "==> Creating local backend config.env"
  cat > config.env <<'EOF'
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/denote
JWT_SECRET=local_dev_secret_change_me
PINATA=local_dev_pinata_placeholder_token
EOF
else
  echo "==> config.env already exists, leaving it untouched"
fi

echo "==> Install complete"
