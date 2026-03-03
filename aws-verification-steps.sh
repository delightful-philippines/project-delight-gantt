#!/bin/bash
echo "=== STEP 1: Check if running container has updated code ==="
docker compose exec frontend grep -n "Starting session check" /app/src/store/useAuthStore.ts 2>&1 || echo "String not found or container not running"

echo ""
echo "=== STEP 2: Check if source files exist in container ==="
docker compose exec frontend ls -la /app/src/store/ 2>&1 || echo "Directory not found"

echo ""
echo "=== STEP 3: Check container status ==="
docker compose ps

echo ""
echo "=== STEP 4: Check when image was created ==="
docker inspect deltan89/project-delight-gantt-frontend:latest --format='{{.Created}}' 2>&1

echo ""
echo "=== STEP 5: Check if container is using the image ==="
CONTAINER_IMAGE=$(docker compose ps -q frontend | xargs docker inspect --format='{{.Image}}')
IMAGE_ID=$(docker images deltan89/project-delight-gantt-frontend:latest -q)
echo "Container using image: $CONTAINER_IMAGE"
echo "Latest image ID: $IMAGE_ID"

if [ "$CONTAINER_IMAGE" = "$IMAGE_ID" ]; then
    echo "✅ Container is using the latest image"
else
    echo "❌ Container is using OLD image - needs restart"
fi
