#!/bin/bash

# Jarvis Daily Triage Script — openclaw VM
# Runs headlessly via cron. Triages Gmail via Gemini CLI,
# writes summary directly to Obsidian vault filesystem.

PATH="/config/.node_global/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# ── Config ────────────────────────────────────────────────────────────────────
GEMINI_BIN="/config/.node_global/bin/gemini"
VAULT_PATH="/config/.openclaw/workspace/PersonalVault"
LOG_FILE="/config/.gemini/tmp/jarvis-triage.log"

# ── Bootstrap ─────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$LOG_FILE")"
echo "--- Starting Jarvis triage at $(date) ---" >> "$LOG_FILE"

# ── 1. Run Gemini Triage ──────────────────────────────────────────────────────
SUMMARY=$("$GEMINI_BIN" \
  --prompt "Triage my latest Gmail inbox. Summarize any urgent alerts or action items concisely. Archive routine newsletters, promotional items, and shipping notifications. Move condo notices to Home. Provide a clean, markdown summary." \
  --approval-mode=yolo \
  --skip-trust 2>&1)

echo "$SUMMARY" >> "$LOG_FILE"

# ── 2. Parse output ───────────────────────────────────────────────────────────
CLEAN_SUMMARY=$(echo "$SUMMARY" | sed -n '/###/,$p')
MECHANICAL_LOGS=$(echo "$SUMMARY" | sed '/###/,$d')

# ── 3. Write triage report to vault ──────────────────────────────────────────
REPORT_DATE=$(date +'%Y-%m-%d-%H-%M')
REPORT_REL="Jarvis Summaries/Triage-${REPORT_DATE}.md"
REPORT_ABS="$VAULT_PATH/$REPORT_REL"

mkdir -p "$(dirname "$REPORT_ABS")"
printf "# Triage Summary: %s\n\n%s\n\n---\n## Process Details & Logs\n\n%s\n" \
  "$(date +'%Y-%m-%d %H:%M')" "$CLEAN_SUMMARY" "$MECHANICAL_LOGS" \
  > "$REPORT_ABS"

# ── 4. Link in today's Daily Note ─────────────────────────────────────────────
DAILY_DATE=$(date +'%Y-%m-%d')
DAILY_ABS="$VAULT_PATH/Daily/${DAILY_DATE}.md"

mkdir -p "$(dirname "$DAILY_ABS")"

# Create daily note if it doesn't exist yet
if [ ! -f "$DAILY_ABS" ]; then
  printf "# %s\n\n## Claude Sessions\n" "$DAILY_DATE" > "$DAILY_ABS"
fi

# Add link under ## Claude Sessions section (or append if section missing)
if grep -q "## Claude Sessions" "$DAILY_ABS"; then
  # Insert after the section header
  sed -i "/## Claude Sessions/a - [[$REPORT_REL|Jarvis Triage Summary $(date +'%H:%M')]]" "$DAILY_ABS"
else
  printf "\n## Claude Sessions\n- [[$REPORT_REL|Jarvis Triage Summary %s]]\n" \
    "$(date +'%H:%M')" >> "$DAILY_ABS"
fi

echo "--- Triage complete at $(date) ---" >> "$LOG_FILE"
