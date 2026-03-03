#!/bin/bash
# Quick diagnostic commands for AWS server

echo "=== CHECK 1: How many backend containers are running? ==="
docker ps -a | grep gantt-backend

echo ""
echo "=== CHECK 2: Current backend logs (last 50 lines) ==="
docker compose logs --tail=50 backend | grep -E '\[Auth|\[Session'

echo ""
echo "=== CHECK 3: Test session endpoint from inside server ==="
curl -s http://localhost:3001/api/auth/session | jq

echo ""
echo "=== CHECK 4: Check if there's a restart loop ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.RunningFor}}"

echo ""
echo "=== NEXT STEP: Attempt login and run this ==="
echo "docker compose logs -f backend | grep -E '\[Auth|\[Session'"
