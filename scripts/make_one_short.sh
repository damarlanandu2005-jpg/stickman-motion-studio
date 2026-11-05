#!/usr/bin/env bash
# ONE script -> one finished short. Bounded tries, no endless loops: a step that cannot be fixed is noted and skipped (or the short is
# dropped with a note). Order: script check -> assets (Kaggle loop) -> costumes (Kaggle loop + assemble) -> voice+render -> code check.
# Usage: scripts/make_one_short.sh scripts_queue/<name>.txt <ledger.json> <out dir>
# Exit code is always 0; the result is in the ledger (status done | done_with_warnings | failed | script_error) and <out>/<name>/.
set -u
SCRIPT="$1"; LEDGER="$2"; OUT="$3"; NAME=$(basename "$SCRIPT" .txt)
export PYTHONPATH=.
RUN="${GITHUB_RUN_ID:-local} $(date -u +%F)"
ST="daily-state/$NAME"; mkdir -p "$ST" "$OUT/$NAME"; : > "$ST/warnings.txt"
rec() { python -m motion_studio.daily record --ledger "$LEDGER" --name "$NAME" --status "$1" --note "${2:-}" --run "$RUN" ${3:+--video "$3"}; }
warn() { echo "WARN: $1" | tee -a "$ST/warnings.txt"; }
finish() {
  cp "$ST"/*.txt "$ST"/*.json "$OUT/$NAME"/ 2>/dev/null
  for L in "$ST"/*.log; do [ -f "$L" ] && tail -n 120 "$L" > "$OUT/$NAME/$(basename "$L").tail"; done   # last lines of every step log, so a failure can be read in the morning
  for C in costume-state/*/out/*/report.json; do [ -f "$C" ] && cp "$C" "$OUT/$NAME/costume_$(basename "$(dirname "$C")")_report.json"; done
  exit 0
}

# 1. the script itself must be readable (author mistakes are not retried; the note tells what to fix)
python -m motion_studio.script_reader "$SCRIPT" --out "$ST/reader0.json" > "$ST/reader0.txt" 2>&1
SERR=$(python - "$ST/reader0.json" <<'PY'
import json, sys
try: r = json.load(open(sys.argv[1]))
except Exception as e: print("reader crashed:", e); raise SystemExit
print("; ".join(e for e in r.get("errors", []) if "costume" not in e)[:600])
PY
)
if [ -n "$SERR" ]; then rec script_error "script problem: $SERR"; finish; fi

# 2. backgrounds and props
timeout 150m scripts/run_assets_auto.sh "$SCRIPT" > "$ST/assets.log" 2>&1 || warn "assets step ended abnormally (code $?)"
tail -5 "$ST/assets.log"
python -m motion_studio.script_reader "$SCRIPT" --write-request "$ST/after_req.json" --out "$ST/reader1.json" > "$ST/reader1.txt" 2>&1
LEFT=$(python -c "import json;print(len(json.load(open('$ST/after_req.json'))['needs']))" 2>/dev/null || echo "?")
[ "$LEFT" != "0" ] && warn "$LEFT background/prop pictures still missing: plain placeholders in the video"

# 3. costumes: write specs for missing ones, draw bodies, put heads on, save to the dataset
python -m motion_studio.script_reader "$SCRIPT" --write-specs animation/costume_specs --out "$ST/reader2.json" > "$ST/reader2.txt" 2>&1
MISSING=$(python -c "import json;r=json.load(open('$ST/reader2.json'));print(' '.join(c for c in r['missing_costumes'] if r['costume_status'][c]!='ready'))" 2>/dev/null || true)
CAST=$(python -c "import sys;from motion_studio import script_reader as s;print(s.parse_script(open(sys.argv[1]).read())['cast'])" "$SCRIPT")
BUILT=false
for C in $MISSING; do
  if [ ! -f "animation/costume_specs/$C.json" ]; then warn "costume '$C' has no 'look' in the cast file: stand-in used"; continue; fi
  timeout 100m scripts/run_costume_auto.sh "animation/costume_specs/$C.json" > "$ST/costume_$C.log" 2>&1 || warn "costume '$C' loop ended abnormally"
  STAND=$(python -c "import json,sys;print(json.load(open(sys.argv[1])).get('costumes',{}).get(sys.argv[2],{}).get('stand_in',''))" "$CAST" "$C")
  ASM=$(python -m motion_studio.costume_assemble --loop-dir "costume-state/$C/out/$C" --name "$C" ${STAND:+--stand-in "$STAND"} | tail -2)
  echo "$ASM" | tee "$ST/costume_${C}_assemble.txt"
  if echo "$ASM" | grep -q "ASSEMBLED=true"; then BUILT=true; warn "costume '$C': drawn automatically, heads borrowed from '${STAND:-explorer}', not reviewed by a person"
  else warn "costume '$C' could not be built: stand-in used"; fi
done
if [ "$BUILT" = true ]; then
  python -m motion_studio.asset_store up --slug stickman-assets --message "costumes for $NAME (auto)" || warn "costume upload to the dataset failed (they exist only in this run)"
fi

# 4. voice + render (single job: parallel parts did not make it faster)
mkdir -p models
if [ ! -f models/kokoro-v1.0.onnx ]; then
  for F in kokoro-v1.0.onnx voices-v1.0.bin; do curl -sSL --retry 4 -o "models/$F" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$F"; done
fi
VID="$OUT/$NAME/$NAME.mp4"
if ! timeout 60m python -m motion_studio.make_short "$SCRIPT" --models models --out "$VID" > "$ST/render.txt" 2>&1; then
  tail -15 "$ST/render.txt"; rec failed "render failed: $(tail -3 "$ST/render.txt" | tr '\n' ' ' | cut -c1-300)"; finish
fi
cp "$OUT/$NAME/${NAME}_work/report.json" "$ST/render_report.json" 2>/dev/null || true

# 5. gentle code checks (only clear breakage fails)
EXPECT=$(python -c "import json;print(round(json.load(open('$ST/render_report.json'))['render']['seconds'],1))" 2>/dev/null || echo "")
python -m motion_studio.video_check "$VID" ${EXPECT:+--expect-seconds "$EXPECT"} > "$ST/video_check.json"; cat "$ST/video_check.json" | tail -3
if ! grep -q "VIDEO_OK=true" "$ST/video_check.json"; then
  rec failed "video check failed: $(python -c "import json,re;t=open('$ST/video_check.json').read();print(json.loads(t[:t.rindex('}')+1])['fails'])" 2>/dev/null)"; finish
fi
python - "$ST/render_report.json" >> "$ST/warnings.txt" 2>/dev/null <<'PY'
import json, sys
for w in json.load(open(sys.argv[1])).get("warnings", []): print("render: " + w)
PY
NW=$(grep -c . "$ST/warnings.txt" || true)
if [ "${NW:-0}" -gt 0 ]; then rec done_with_warnings "$(head -6 "$ST/warnings.txt" | tr '\n' ' ' | cut -c1-500) (${NW} warnings in total)" "shorts/$NAME/$NAME.mp4"
else rec done "" "shorts/$NAME/$NAME.mp4"; fi
finish
