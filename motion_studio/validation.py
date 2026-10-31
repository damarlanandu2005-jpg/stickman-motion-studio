from __future__ import annotations
import json
from pathlib import Path
from .models import Check
def read_json(path: Path):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc: raise ValueError(f"Missing required file: {path}") from exc
    except json.JSONDecodeError as exc: raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
def validate_project(project: Path):
    checks=[]
    try:
        data=read_json(project/"storyboard"/"story.json")
        required=["project_id","title","language","target","beats"]
        missing=[k for k in required if k not in data]
        checks.append(Check("manifest_fields",not missing,f"Missing fields: {missing}" if missing else "Required fields exist"))
        beats=data.get("beats",[])
        checks.append(Check("beats_present",isinstance(beats,list) and bool(beats),f"{len(beats)} beat(s) found"))
        for i,beat in enumerate(beats):
            ok=all(k in beat for k in ("id","narration","duration_seconds","shot_ids")) and float(beat.get("duration_seconds",0))>0
            checks.append(Check(f"beat_{i+1}",ok,f"Beat {beat.get('id',i+1)} {'valid' if ok else 'incomplete'}"))
    except (ValueError,TypeError) as exc: checks.append(Check("story_manifest",False,str(exc)))
    for name,path in [("shots_manifest",project/"storyboard"/"shots.json"),("research_ledger",project/"research"/"sources.json")]:
        try:
            item=read_json(path)
            if name=="shots_manifest" and not isinstance(item.get("shots"),list): raise ValueError("shots must be an array")
            checks.append(Check(name,True,"JSON readable"))
        except ValueError as exc: checks.append(Check(name,False,str(exc)))
    return checks
