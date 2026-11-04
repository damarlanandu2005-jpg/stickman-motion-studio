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
# 3. save everything accepted into the dataset, then prove it comes back
ACC=$(python -c "import json,os;p='$STATE/accepted.json';print(' '.join(json.load(open(p))) if os.path.exists(p) else '')")
VERIFY="not needed"
if [ -n "$ACC" ]; then
  python -m motion_studio.asset_store up --slug "$SLUG" --message "assets for $NAME (auto, run ${GITHUB_RUN_ID:-local})" || echo "UP FAILED"
  FRESH=$(mktemp -d)
  python -m motion_studio.asset_store down --slug "$SLUG" --lib "$FRESH" >/dev/null
  if python -m motion_studio.asset_store verify --lib "$FRESH" $ACC; then VERIFY="ok: $ACC found again after a clean download"; else VERIFY="FAILED"; fi
  python -m motion_studio.script_reader "$SCRIPT" --lib "$FRESH" --out "$STATE/reader_after.json" | tee "$STATE/reader_after.txt"
fi
{ echo "assets $NAME: complete=$DONE, round files in $STATE"; echo "dataset verify: $VERIFY"; cat "$STATE/report.json" 2>/dev/null | head -40; } | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
exit 0
