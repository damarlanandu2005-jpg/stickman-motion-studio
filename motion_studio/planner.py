from __future__ import annotations
import json
from pathlib import Path
from .models import STAGES
from .state import load_state
REQUIREMENTS={"research":["research/sources.json"],"script":["script/script.md"],"visual_direction":["storyboard/shots.json"],"artwork":["artwork/approved"],"animation":["animation/approved"],"audio":["audio"],"render":["animation/approved"],"quality_control":["renders"],"human_approval":["reports/final_approval.json"]}
def readiness(project: Path):
    state=load_state(project)
    shots_path=project/"storyboard"/"shots.json"
    shots=json.loads(shots_path.read_text(encoding="utf-8")).get("shots",[]) if shots_path.exists() else []
    rows=[]
    for stage in STAGES:
        missing=[x for x in REQUIREMENTS[stage] if not (project/x).exists()]
        if stage=="visual_direction" and not shots: missing.append("storyboard/shots.json (must contain shots)")
        if stage=="animation" and not list((project/"animation"/"approved").glob("*.mp4")): missing.append("animation/approved/*.mp4 (approved animated clips)")
        if stage=="human_approval" and not (project/"reports"/"final_approval.json").exists(): missing.append("reports/final_approval.json")
        rows.append({"stage":stage,"status":state["stages"].get(stage,{}).get("status","pending"),"ready":not missing,"missing":missing})
    return rows
