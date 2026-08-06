#!/bin/bash
# Llama al endpoint de triage de Baltimore. Pensado para correr vía launchd (ver scripts/com.agents101.baltimore-triage.plist).
# Requiere que `npm run dev` esté corriendo en localhost:3000 en ese momento.
set -uo pipefail

LOG_DIR="/Users/cristianborja/Projects/agents-101/data/logs"
mkdir -p "$LOG_DIR"

{
  echo "---- $(date) ----"
  curl -sf -X POST http://localhost:3000/api/gmail/triage \
    -o "$LOG_DIR/last-triage-response.json" \
    -w "HTTP %{http_code}\n" \
    || echo "curl falló — ¿está corriendo 'npm run dev'?"
} >> "$LOG_DIR/morning-triage.log" 2>&1
