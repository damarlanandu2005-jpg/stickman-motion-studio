from __future__ import annotations
import json
from pathlib import Path
from .models import STAGES
from .state import load_state

AUDIO_EXTENSIONS={".wav",".mp3",".m4a",".aac",".flac",".ogg"}
def readiness(project: Path):
    state=load_state(project)
    rows=[]
    try:
        shots=json.loads((project/"storyboard"/"shots.json").read_text(encoding="utf-8")).get("shots",[])
    except (OSError,json.JSONDecodeError,AttributeError):
        shots=[]
    try:
        research=json.loads((project/"research"/"sources.json").read_text(encoding="utf-8"))
    except (OSError,json.JSONDecodeError):
        research={}
    for stage in STAGES:
        missing=[]
        if stage=="research":
            if not research.get("sources"): missing.append("research/sources.json (add credible sources)")
            if not research.get("claims"): missing.append("research/sources.json (map factual claims to source IDs)")
            if any(c.get("status")!="verified" for c in research.get("claims",[]) if isinstance(c,dict)):
                missing.append("all research claims must have status=verified")
        elif stage=="script":
            script=project/"script"/"script.md"
            if not script.is_file() or "[Draft narration" in script.read_text(encoding="utf-8"):
                missing.append("script/script.md (write and review narration)")
        elif stage=="visual_direction":
            if not shots: missing.append("storyboard/shots.json (add shot entries)")
            else:
                required=("id","beat_id","narration","duration_seconds","environment","character_action","camera","motion_method","required_assets")
                for shot in shots:
                    if any(key not in shot for key in required):
                        missing.append(f"shot {shot.get('id','?')} has incomplete direction")
                        break
        elif stage=="artwork":
            approved=project/"artwork"/"approved"
            if not approved.exists() or not any(p.is_file() for p in approved.rglob("*")):
                missing.append("artwork/approved/ (add reviewed character, background and prop assets)")
        elif stage=="animation":
            clips=list((project/"animation"/"approved").glob("*.mp4"))
            if not clips: missing.append("animation/approved/*.mp4 (approved animated clips)")
            if shots and any(not s.get("animation_clip") for s in shots):
                missing.append("each storyboard shot needs an animation_clip path")
        elif stage=="audio":
            audio=project/"audio"
            if not audio.exists() or not any(p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS for p in audio.rglob("*")):
                missing.append("audio/ (add approved narration/audio files)")
        elif stage=="render":
            if not (project/"renders"/"final.mp4").is_file(): missing.append("renders/final.mp4 (render approved shot clips)")
        elif stage=="quality_control":
            if not (project/"reports"/"qc.json").is_file(): missing.append("reports/qc.json (record QC results)")
        elif stage=="human_approval":
            approval=project/"reports"/"final_approval.json"
            if not approval.is_file(): missing.append("reports/final_approval.json")
            else:
                try:
                    if json.loads(approval.read_text(encoding="utf-8")).get("approved") is not True:
                        missing.append("reports/final_approval.json (approved must be true)")
                except (OSError,json.JSONDecodeError):
                    missing.append("reports/final_approval.json (invalid JSON)")
        rows.append({"stage":stage,"status":state["stages"].get(stage,{}).get("status","pending"),"ready":not missing,"missing":missing})
    return rows
