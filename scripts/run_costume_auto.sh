#!/usr/bin/env bash
# Automatic costume loop for ONE spec file: Kaggle draws -> code judges -> failed poses redrawn (new seeds, accepted poses as reference)
# -> accepted poses saved. No person in the middle. Usage: scripts/run_costume_auto.sh animation/costume_specs/<name>.json
set -u
. scripts/kaggle_accounts.sh; ka_init
SPEC="$1"
NAME=$(python -c "import json,sys;print(json.load(open(sys.argv[1]))['name'])" "$SPEC")
MAX=$(python -c "import json,sys;print(json.load(open(sys.argv[1]))['max_rounds'])" "$SPEC")
STATE="costume-state/$NAME"; mkdir -p "$STATE"
RUN_ID="${GITHUB_RUN_ID:-local}"
git config user.name "github-actions[bot]"; git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
DONE=false
for ROUND in $(seq 1 "$MAX"); do
  echo "=== $NAME round $ROUND of $MAX ==="
  PLAN=$(PYTHONPATH=. python -m motion_studio.costume_loop plan --spec "$SPEC" --round "$ROUND" --state "$STATE") || { echo "plan failed"; break; }
  echo "$PLAN"
  if echo "$PLAN" | grep -q "NEEDS_REF_COMMIT=true"; then
    # the Kaggle notebook downloads its references from a pushed commit, so the accepted sheet needs one
    REFS=$(echo "$PLAN" | grep '^REF_FILES=' | cut -d= -f2- | tr ',' ' ')
    for F in $REFS; do git add -f "$F"; done
    git commit -q -m "costume ${NAME}: accepted-so-far sheet for round ${ROUND} (automatic)"
    git push -q origin "HEAD:refs/heads/costume-refs-${RUN_ID}" || echo "ref push failed"
  fi
  export GITHUB_SHA="$(git rev-parse HEAD)"
  python scripts/build_scene_batch_notebook.py
  OUTDIR="$STATE/kaggle-r${ROUND}"
  for TRY in 1 2; do
    rm -rf "$OUTDIR"
    if python -m motion_studio.kaggle_runner --kernel "$(ka_user)/stickman-motion-studio-scene-batch" \
         --title "Stickman Motion Studio Scene Batch" --kernel-dir kaggle/scene-batch --notebook scene_batch.ipynb --out "$OUTDIR" \
         --profile poses --timeout-minutes 60 --kaggle-run-limit-seconds 3600; then break; fi
    echo "Kaggle try $TRY failed"; ka_swap; sleep 20
  done
  mkdir -p "$OUTDIR"
  JUDGE=$(PYTHONPATH=. python -m motion_studio.costume_loop judge --spec "$SPEC" --round "$ROUND" --state "$STATE" --outputs "$OUTDIR")
  echo "$JUDGE"
  if echo "$JUDGE" | grep -q "DONE=true"; then DONE=true; break; fi
done
echo "costume $NAME complete=$DONE" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
cat "$STATE/out/$NAME/report.json" 2>/dev/null | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}" | head -60
exit 0
