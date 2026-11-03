"""Render a recreated reference short from its shot list + the Kaggle pictures, then compare with the original.
python animation/scenes/render_ref.py v1 pictures_dir out_dir"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from motion_studio.assemble import assemble
from motion_studio.compare import stats
from motion_studio.scene_plan import auto_sfx, caption_y

name, pics, out = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
here = Path(__file__).parent
shots = json.loads((here / f"ref_{name}_shots.json").read_text())
plan = {p["id"]: p for p in json.loads((here / f"ref_{name}_plan.json").read_text())}
for s in shots:
    s["sfx"] = auto_sfx(plan[s["id"]])
    s["cap_y"] = caption_y(plan[s["id"]])
out.mkdir(parents=True, exist_ok=True)
mp4 = out / f"recreate_{name}.mp4"
info = assemble(shots, pics, mp4)
print(info)
a, b = stats(f"/tmp/refs/{name}/v.mp4"), stats(str(mp4))
print(f"{'':22}{'reference':>12}{'ours':>12}")
for k in a:
    print(f"{k:22}{a[k]:>12}{b[k]:>12}")
(out / f"compare_{name}.json").write_text(json.dumps({"reference": a, "ours": b, "info": info}, indent=1))
