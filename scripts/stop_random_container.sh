#!/usr/bin/env bash
# Stops a random container from the list. Not run automatically.
set -euo pipefail

SERVICES=("uptime-kuma" "backend" "cadvisor" "prometheus" "frontend" "grafana")
CHOICE=${SERVICES[$((RANDOM % ${#SERVICES[@]}))]}

echo "Selected service: $CHOICE"
# Find running container matching the service name
CID=$(docker ps -q --filter "name=$CHOICE" | head -n 1)
if [ -z "$CID" ]; then
  echo "No running container matching '$CHOICE' found. Exiting."
  exit 1
fi

echo "Stopping container $CID (service $CHOICE)"
docker stop "$CID"

echo "Stopped $CID"
