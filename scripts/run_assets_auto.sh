#!/usr/bin/env bash
# Automatic assets for ONE script: reader lists what is missing -> Kaggle draws -> code judges -> failed ones redrawn -> accepted saved
# -> pushed to the Kaggle dataset -> pulled again into a clean folder and checked. No person in the middle.
# Usage: scripts/run_assets_auto.sh scripts_in/<name>.txt
set -u
SCRIPT="$1"; NAME=$(basename "$SCRIPT" .txt)
OWNER=$(echo "${KAGGLE_USERNAME:-}" | tr -d '[:space:]'); SLUG=stickman-assets
STATE="assets-state/$NAME"; mkdir -p "$STATE" animation/asset_requests
REQ="animation/asset_requests/$NAME.json"
export PYTHONPATH=.
# 1. pull the dataset into the library (first time: dataset does not exist -> push the current library as the start)
DOWN=$(python -m motion_studio.asset_store down --slug "$SLUG"); echo "$DOWN"
if echo "$DOWN" | grep -q "NO_DATASET=true"; then
  python -m motion_studio.asset_store up --slug "$SLUG" --message "bootstrap from repo library" || { echo "bootstrap failed"; exit 0; }
fi
# 1b. the character sprites (animation/assets2d) must live in the dataset too: first time, take them from the seed on branch test-results
if ! python -c "import json,sys;sys.exit(0 if json.load(open('animation/asset_library/index.json')).get('sprites') else 1)"; then
  if git ls-remote --exit-code --heads origin test-results >/dev/null 2>&1; then
    git fetch -q --depth 1 origin test-results && git worktree add -q /tmp/seed FETCH_HEAD 2>/dev/null
    if [ -d /tmp/seed/sprites-seed ]; then
      mkdir -p animation/assets2d && cp -r /tmp/seed/sprites-seed/. animation/assets2d/
      python -m motion_studio.asset_store up --slug "$SLUG" --message "seed character sprites" || echo "SPRITE SEED UP FAILED"
    else echo "no sprites-seed on test-results"; fi
  fi
fi
# 2. what does the script need that the library does not have
python -m motion_studio.script_reader "$SCRIPT" --write-request "$REQ" --out "$STATE/reader.json" | tee "$STATE/reader.txt"
NEED=$(python -c "import json,sys;print(len(json.load(open(sys.argv[1]))['needs']))" "$REQ")
echo "missing assets: $NEED"
DONE=false; [ "$NEED" = "0" ] && DONE=true
for ROUND in 1 2 3; do
  [ "$DONE" = true ] && break
  echo "=== $NAME assets round $ROUND of 3 ==="
  PLAN=$(python -m motion_studio.asset_auto plan --request "$REQ" --round "$ROUND" --state "$STATE") || { echo "plan failed"; break; }
  echo "$PLAN"
  echo "$PLAN" | grep -q "NOTHING_PENDING=true" && { DONE=true; break; }
  EXTRA=""; echo "$PLAN" | grep -q "USES_DATASET=true" && EXTRA="--dataset-source $OWNER/$SLUG"
  # the notebook needs the dataset version that holds the style references: it is the one pulled in step 1 (or the bootstrap)
  python scripts/build_scene_batch_notebook.py
  OUTDIR="$STATE/kaggle-r$ROUND"
  for TRY in 1 2; do
    rm -rf "$OUTDIR"
    if python -m motion_studio.kaggle_runner --kernel "$OWNER/stickman-motion-studio-scene-batch" \
         --title "Stickman Motion Studio Scene Batch" --kernel-dir kaggle/scene-batch --notebook scene_batch.ipynb --out "$OUTDIR" \
         --profile poses --timeout-minutes 60 --kaggle-run-limit-seconds 3600 $EXTRA; then break; fi
    echo "Kaggle try $TRY failed"; sleep 20
  done
  mkdir -p "$OUTDIR"
  JUDGE=$(python -m motion_studio.asset_auto judge --request "$REQ" --round "$ROUND" --state "$STATE" --outputs "$OUTDIR")
  echo "$JUDGE"; echo "$JUDGE" | grep -q "DONE=true" && DONE=true
done
# 3. save everything accepted into the dataset, then prove it comes back (clean folder, own download, hash check, reader run)
ACC=$(python -c "import json,os;p='$STATE/accepted.json';print(' '.join(json.load(open(p))) if os.path.exists(p) else '')")
VERIFY="not needed"
if [ -n "$ACC" ]; then
  python -m motion_studio.asset_store up --slug "$SLUG" --message "assets for $NAME (auto, run ${GITHUB_RUN_ID:-local})" || echo "UP FAILED"
  FRESH=$(mktemp -d); VERIFY="FAILED"
  for TRY in 1 2 3; do
    rm -rf "$FRESH"/*; sleep $((10 * TRY))
    python -m motion_studio.asset_store down --slug "$SLUG" --lib "$FRESH/animation/asset_library" --sprites "$FRESH/animation/assets2d" || continue
    if python -m motion_studio.asset_store verify --lib "$FRESH/animation/asset_library" --sprites "$FRESH/animation/assets2d" $ACC | tee "$STATE/verify.json" | grep -q '"ok": true'; then
      VERIFY="ok: $ACC and all sprites found again after a clean download"; break; fi
  done
  python -m motion_studio.script_reader "$SCRIPT" --lib "$FRESH/animation/asset_library" --root "$FRESH" --out "$STATE/reader_after.json" | tee "$STATE/reader_after.txt"
fi
{ echo "assets $NAME: complete=$DONE, round files in $STATE"; echo "dataset verify: $VERIFY"; cat "$STATE/verify.json" 2>/dev/null; cat "$STATE/report.json" 2>/dev/null | head -40; } | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
exit 0
