#!/usr/bin/env bash
# Heads and extra poses for the characters ONE script uses (from its cast file). All characters in one Kaggle run per round, 3 rounds,
# then the best picture (soft flaws allowed, marked) is installed into animation/assets2d/<folder> and saved to the Kaggle dataset.
# Usage: scripts/run_cast_auto.sh <script.txt>     Never loops forever; exit code always 0 (results in cast-state/<name>/cast_notes.json).
set -u
SCRIPT="$1"; NAME=$(basename "$SCRIPT" .txt); SLUG=stickman-assets
export PYTHONPATH=.
. scripts/kaggle_accounts.sh; ka_init
STATE="cast-state/$NAME"; mkdir -p "$STATE"; REQ="$STATE/request.json"
python -m motion_studio.cast_auto needs --script "$SCRIPT" --out "$REQ" | tee "$STATE/needs.txt"
grep -q "CAST_NEEDS=0" "$STATE/needs.txt" && { echo "cast: nothing to draw"; echo '[]' > "$STATE/cast_notes.json"; exit 0; }
# pose drawings use the character's standing body as reference, read from the dataset: make sure the dataset has the current sprites
python -m motion_studio.asset_store up --slug "$SLUG" --message "sprites before cast drawing for $NAME (auto)" || echo "UP FAILED (references may be missing)"
DONE=false
for ROUND in 1 2 3; do
  PLAN=$(python -m motion_studio.cast_auto plan --request "$REQ" --round "$ROUND" --state "$STATE"); echo "$PLAN"
  echo "$PLAN" | grep -q "NOTHING_PENDING=true" && { DONE=true; break; }
  EXTRA=""; echo "$PLAN" | grep -q "USES_DATASET=true" && EXTRA="--dataset-source $DATASET_OWNER/$SLUG"
  export GITHUB_SHA="$(git rev-parse HEAD)"
  python scripts/build_scene_batch_notebook.py
  OUTDIR="$STATE/kaggle-r$ROUND"
  for TRY in 1 2; do
    rm -rf "$OUTDIR"
    if python -m motion_studio.kaggle_runner --kernel "$(ka_user)/stickman-motion-studio-scene-batch" --title "Stickman Motion Studio Scene Batch" \
         --kernel-dir kaggle/scene-batch --notebook scene_batch.ipynb --out "$OUTDIR" --profile poses --timeout-minutes 60 \
         --kaggle-run-limit-seconds 3600 $EXTRA; then break; fi
    echo "Kaggle try $TRY failed"; ka_swap; sleep 20
  done
  mkdir -p "$OUTDIR"
  JUDGE=$(python -m motion_studio.cast_auto judge --request "$REQ" --round "$ROUND" --state "$STATE" --outputs "$OUTDIR"); echo "$JUDGE"
  echo "$JUDGE" | grep -q "DONE=true" && { DONE=true; break; }
done
python -m motion_studio.cast_auto finalize --request "$REQ" --state "$STATE" | tee "$STATE/finalize.txt"
python -m motion_studio.asset_store up --slug "$SLUG" --message "heads and poses for $NAME (auto)" || echo "UP FAILED (new heads/poses exist only in this run)"
echo "cast $NAME complete=$DONE"
exit 0
