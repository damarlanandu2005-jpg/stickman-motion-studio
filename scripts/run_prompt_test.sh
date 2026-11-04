#!/usr/bin/env bash
# Prompt-format test: the same scene asked in 4 ways (3 seeds each) + 4 ways to ask for an edit of an existing picture (2 seeds each).
# Pictures are published to test-results/prompt-test/ to be looked at. Nothing is judged by code here.
set -u
OWNER=$(echo "${KAGGLE_USERNAME:-}" | tr -d '[:space:]'); SLUG=stickman-assets
export PYTHONPATH=.
python -m motion_studio.asset_store down --slug "$SLUG" || { echo "dataset down failed"; exit 0; }
cp kaggle/prompt-test/jobs.json kaggle/scene-batch/jobs.json
export GITHUB_SHA="$(git rev-parse HEAD)"
python scripts/build_scene_batch_notebook.py
OUT=prompt-test-state/out; rm -rf "$OUT"
for TRY in 1 2; do
  if python -m motion_studio.kaggle_runner --kernel "$OWNER/stickman-motion-studio-scene-batch" --title "Stickman Motion Studio Scene Batch" \
       --kernel-dir kaggle/scene-batch --notebook scene_batch.ipynb --out "$OUT" --profile poses --timeout-minutes 60 --kaggle-run-limit-seconds 3600 \
       --dataset-source "$OWNER/$SLUG"; then break; fi
  echo "Kaggle try $TRY failed"; sleep 20
done
mkdir -p "$OUT"; ls "$OUT" | head -30
exit 0
