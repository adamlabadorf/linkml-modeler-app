#!/usr/bin/env bash
# check-token-usage.sh — Enforces CSS token usage in component source.
#
# Checks:
#   1. fontFamily:'monospace' — zero-tolerance (all migrated in PTS-90)
#   2. 6-char hex color literals in string values — count-based baseline
#      (catches '#rrggbb' style strings; embedded hex like '1px solid #...' is a known gap)
#
# Baseline: 0 — all hex violations migrated to CSS tokens in PTS-92.
#
# SVG attribute context (e.g. <Background color="#334155">, MiniMap nodeColor returns)
# uses non-quoted-hex patterns and is not caught by check 2 — this is intentional.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT_DIR"

SOURCES=(packages/core/src packages/web/src)
FAILED=0

# ── 1. fontFamily:'monospace' — strict zero ───────────────────────────────────
MONO_COUNT=$(grep -rn --include='*.ts' --include='*.tsx' \
    -E "fontFamily\s*:\s*['\"]monospace['\"]" "${SOURCES[@]}" 2>/dev/null \
    | wc -l | tr -d ' ') || MONO_COUNT=0

if [ "${MONO_COUNT}" -gt 0 ]; then
  echo "ERROR: ${MONO_COUNT} hardcoded fontFamily:monospace found (expected 0)."
  echo "       Use var(--font-family-mono) instead."
  grep -rn --include='*.ts' --include='*.tsx' \
    -E "fontFamily\s*:\s*['\"]monospace['\"]" "${SOURCES[@]}" 2>/dev/null || true
  FAILED=1
else
  echo "OK  fontFamily:monospace — 0 violations."
fi

# ── 2. 6-char hex color literals — count-based baseline ───────────────────────
# Pattern matches strings like '#1a2b3c' (quoted standalone hex).
# When this count drops below BASELINE_HEX, reduce the baseline to lock in progress.
BASELINE_HEX=0

HEX_COUNT=$(grep -rn --include='*.ts' --include='*.tsx' \
    -E "'#[0-9a-fA-F]{6}'" "${SOURCES[@]}" 2>/dev/null \
    | wc -l | tr -d ' ') || HEX_COUNT=0

if [ "${HEX_COUNT}" -gt "${BASELINE_HEX}" ]; then
  echo "ERROR: Hex color violations increased (baseline: ${BASELINE_HEX}, current: ${HEX_COUNT})."
  echo "       Use CSS tokens via var(--...) instead of hardcoded hex values."
  echo "       Diff your changes against main to identify new violations."
  FAILED=1
elif [ "${HEX_COUNT}" -lt "${BASELINE_HEX}" ]; then
  echo "INFO  Hex violations reduced (${BASELINE_HEX} → ${HEX_COUNT})."
  echo "      Update BASELINE_HEX in scripts/check-token-usage.sh to ${HEX_COUNT}."
else
  echo "OK  Hex color literals — ${HEX_COUNT}/${BASELINE_HEX} (at baseline)."
fi

# ── Result ────────────────────────────────────────────────────────────────────
if [ "${FAILED}" -eq 0 ]; then
  echo "PASS token usage check."
else
  echo "FAIL token usage check — see errors above."
fi
exit "${FAILED}"
