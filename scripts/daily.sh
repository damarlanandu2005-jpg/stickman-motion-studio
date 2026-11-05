#!/usr/bin/env bash
# Daily run: take the next N scripts from scripts_queue/ and make them ONE AFTER ANOTHER (each fully finished before the next starts).
# Time guard: no new short is started after BUDGET_MIN minutes. Results: ledger + morning note, published to branch test-results.
# Usage: scripts/daily.sh [N]
set -u
N="${1:-3}"; BUDGET_MIN="${BUDGET_MIN:-270}"
export PYTHONPATH=.
RUN="${GITHUB_RUN_ID:-local}"; DAY=$(TZ=Asia/Kolkata date +%F); OUT="daily-out/$DAY"; mkdir -p "$OUT"
git config user.name "github-actions[bot]"; git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
publish() {   # copy $OUT + ledger to test-results/daily/<day>/ ; several tries, never fatal
  git ls-remote --exit-code --heads origin test-results >/dev/null 2>&1 || return 0
  rm -rf /tmp/pub; git fetch -q --depth 1 origin test-results && git worktree add -q -f /tmp/pub FETCH_HEAD 2>/dev/null || return 0
  ( cd /tmp/pub && git checkout -q -B test-results && mkdir -p "daily/$DAY" shorts
    cp -r "$GITHUB_WORKSPACE/$OUT"/. "daily/$DAY"/ 2>/dev/null
    for D in "$GITHUB_WORKSPACE/$OUT"/*/; do B=$(basename "$D"); [ -f "$D/$B.mp4" ] && { mkdir -p "shorts/$B"; cp "$D/$B.mp4" "shorts/$B/"; }; done
    cp "$GITHUB_WORKSPACE/$LEDGER" daily/ledger.json 2>/dev/null; cp "$GITHUB_WORKSPACE/$OUT/MORNING_NOTE.md" daily/MORNING_NOTE.md 2>/dev/null
    git add daily shorts; git commit -q -m "Daily $DAY run $RUN [skip ci]" || exit 0
    for TRY in 1 2 3 4 5; do git push -q origin test-results && exit 0; sleep $((10 * TRY)); git fetch -q --depth 1 origin test-results && git rebase -q FETCH_HEAD || true; done; exit 1 )
  git worktree remove --force /tmp/pub 2>/dev/null; return 0
}
# ledger lives on test-results (survives between days)
LEDGER="daily-state/ledger.json"; mkdir -p daily-state
if git ls-remote --exit-code --heads origin test-results >/dev/null 2>&1; then
  git fetch -q --depth 1 origin test-results && git show FETCH_HEAD:daily/ledger.json > "$LEDGER" 2>/dev/null || echo '{}' > "$LEDGER"
else echo '{}' > "$LEDGER"; fi
if [ -n "${ONLY:-}" ]; then LIST="scripts_queue/$ONLY.txt"      # redo one named script (ignores the ledger)
else LIST=$(python -m motion_studio.daily pick --queue scripts_queue --ledger "$LEDGER" -n "$N"); fi
echo "Today's scripts:"; echo "${LIST:-<none>}"
START=$(date +%s); NAMES=""
for S in $LIST; do
  if [ $(( ($(date +%s) - START) / 60 )) -ge "$BUDGET_MIN" ]; then echo "time budget used up: $S waits for tomorrow"; continue; fi
  B=$(basename "$S" .txt); NAMES="$NAMES $B"
  echo "=============== $B ($(date -u +%T)) ==============="
  scripts/make_one_short.sh "$S" "$LEDGER" "$OUT" 2>&1 | tail -80
  python -m motion_studio.daily note --ledger "$LEDGER" --run "$DAY (in progress)" $NAMES > "$OUT/MORNING_NOTE.md"
  publish        # after every short: a crash later cannot lose finished ones
done
python -m motion_studio.daily note --ledger "$LEDGER" --run "$DAY" $NAMES | tee "$OUT/MORNING_NOTE.md" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
publish
exit 0
