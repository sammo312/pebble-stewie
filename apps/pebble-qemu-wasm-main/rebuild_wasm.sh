#!/bin/bash
# Incremental WASM rebuild for pebble-qemu-wasm
# After the initial full build, this script does an incremental rebuild
# by copying modified source files and running ninja.
#
# Usage:
#   # First time: run the full build_wasm.sh to create the container
#   # Then for incremental changes:
#   bash rebuild_wasm.sh
#
# Or specify individual files to update:
#   bash rebuild_wasm.sh hw/arm/pebble_control.c hw/arm/pebble.c

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="build-pebble-wasm"
WEB_DIR="${SCRIPT_DIR}/web"

# Check container exists and is running
if ! docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}" | grep -q "${CONTAINER_NAME}"; then
    echo "Error: Container '${CONTAINER_NAME}' is not running."
    echo "Run build_wasm.sh first to create the build environment."
    exit 1
fi

echo "=== Copying modified files ==="

if [ $# -gt 0 ]; then
    # Copy specific files
    for f in "$@"; do
        echo "  ${f}"
        docker cp "${SCRIPT_DIR}/${f}" "${CONTAINER_NAME}:/qemu-rw/${f}"
    done
else
    # Copy all Pebble source files
    for dir in arm misc char ssi timer dma display gpio; do
        if [ -d "${SCRIPT_DIR}/hw/${dir}" ]; then
            for f in "${SCRIPT_DIR}/hw/${dir}"/*; do
                [ -f "$f" ] || continue
                local_path="hw/${dir}/$(basename "$f")"
                echo "  ${local_path}"
                docker cp "$f" "${CONTAINER_NAME}:/qemu-rw/${local_path}"
            done
        fi
    done
    # Copy headers
    for f in "${SCRIPT_DIR}/include/hw/arm"/*; do
        [ -f "$f" ] || continue
        local_path="include/hw/arm/$(basename "$f")"
        echo "  ${local_path}"
        docker cp "$f" "${CONTAINER_NAME}:/qemu-rw/${local_path}"
    done
fi

echo ""
echo "=== Building ==="
docker exec "${CONTAINER_NAME}" bash -c 'cd /build && ninja -j$(nproc) qemu-system-arm.js 2>&1'

echo ""
echo "=== Copying artifacts ==="
docker cp "${CONTAINER_NAME}:/build/qemu-system-arm.js" "${WEB_DIR}/"
docker cp "${CONTAINER_NAME}:/build/qemu-system-arm.wasm" "${WEB_DIR}/"
docker cp "${CONTAINER_NAME}:/build/qemu-system-arm.worker.js" "${WEB_DIR}/"

echo ""
echo "=== Done ==="
ls -lh "${WEB_DIR}/qemu-system-arm"*
