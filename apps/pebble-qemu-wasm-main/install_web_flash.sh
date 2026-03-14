#!/bin/bash
# Install a PBW into the browser emulator's shared SDK SPI flash.
#
# Usage:
#   bash apps/pebble-qemu-wasm-main/install_web_flash.sh [path/to/app.pbw]
#
# This boots the legacy Pebble SDK emulator against the same
# `web/firmware/sdk/qemu_spi_flash.bin` consumed by the WASM builder iframe,
# installs the app via `pebble install --qemu`, then shuts QEMU down.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PBW_PATH="${1:-${ROOT_DIR}/build/pebble-stewie.pbw}"

QEMU_BIN="${PEBBLE_QEMU_PATH:-$HOME/Library/Application Support/Pebble SDK/SDKs/4.9.127/toolchain/bin/qemu-pebble}"
MICRO_FLASH="${SCRIPT_DIR}/web/firmware/sdk/qemu_micro_flash.bin"
SPI_FLASH="${SCRIPT_DIR}/web/firmware/sdk/qemu_spi_flash.bin"
QEMU_PORT="${PEBBLE_WEB_QEMU_PORT:-12344}"
SERIAL_PORT="${PEBBLE_WEB_QEMU_SERIAL_PORT:-12345}"
GDB_PORT="${PEBBLE_WEB_QEMU_GDB_PORT:-12346}"
MONITOR_PORT="${PEBBLE_WEB_QEMU_MONITOR_PORT:-12347}"
BOOT_WAIT_SEC="${PEBBLE_WEB_QEMU_BOOT_WAIT_SEC:-30}"

if [ ! -f "${PBW_PATH}" ]; then
  echo "PBW not found: ${PBW_PATH}" >&2
  exit 1
fi

if [ ! -x "${QEMU_BIN}" ]; then
  echo "QEMU binary not found or not executable: ${QEMU_BIN}" >&2
  exit 1
fi

if [ ! -f "${MICRO_FLASH}" ] || [ ! -f "${SPI_FLASH}" ]; then
  echo "Expected web firmware at ${SCRIPT_DIR}/web/firmware/sdk/" >&2
  exit 1
fi

cleanup() {
  if [ -n "${QEMU_PID:-}" ] && kill -0 "${QEMU_PID}" 2>/dev/null; then
    kill "${QEMU_PID}" 2>/dev/null || true
    wait "${QEMU_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

echo "Starting qemu-pebble with shared web flash..."
"${QEMU_BIN}" \
  -rtc base=localtime \
  -serial null \
  -serial "tcp::${QEMU_PORT},server,nowait" \
  -serial "tcp::${SERIAL_PORT},server,nowait" \
  -pflash "${MICRO_FLASH}" \
  -gdb "tcp::${GDB_PORT},server,nowait" \
  -monitor "tcp::${MONITOR_PORT},server,nowait" \
  -machine pebble-snowy-emery-bb \
  -cpu cortex-m4 \
  -pflash "${SPI_FLASH}" \
  >/tmp/pebble-web-flash-qemu.log 2>&1 &

QEMU_PID=$!

echo "Waiting ${BOOT_WAIT_SEC}s for emulator boot..."
sleep "${BOOT_WAIT_SEC}"

echo "Installing ${PBW_PATH} into ${SPI_FLASH}..."
pebble install --qemu "localhost:${QEMU_PORT}" "${PBW_PATH}"

echo "Web emulator flash updated."
