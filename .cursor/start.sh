#!/usr/bin/env bash
# Per-boot startup: ensure a local MongoDB server is running.
# Idempotent — does nothing if MongoDB is already listening on 27017.
set -euo pipefail

sudo mkdir -p /data/db
sudo chown -R "$(whoami)" /data/db

if pgrep -x mongod >/dev/null 2>&1; then
  echo "MongoDB already running"
  exit 0
fi

echo "Starting MongoDB on 127.0.0.1:27017"
mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 \
  --logpath /data/db/mongod.log --fork

# Wait for MongoDB to accept connections.
for i in $(seq 1 30); do
  if (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null; then
    echo "MongoDB is ready"
    exit 0
  fi
  sleep 1
done

echo "MongoDB did not become ready in time" >&2
exit 1
