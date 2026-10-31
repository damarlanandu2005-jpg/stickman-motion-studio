from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path
from .models import STAGES

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def load_state(project: Path):
    path = project / ".studio" / "state.json"
    if not path.exists():
        return {"project_id":project.name,"updated_at":utc_now(),"stages":{s:{"status":"pending","attempts":0} for s in STAGES}}
    return json.loads(path.read_text(encoding="utf-8"))

def save_state(project: Path, state):
    path = project / ".studio" / "state.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    state["updated_at"] = utc_now()
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(state,indent=2),encoding="utf-8")
    temp.replace(path)

def set_stage(project: Path, stage: str, status: str, message: str="", outputs=None):
    if stage not in STAGES: raise ValueError(f"Unknown stage: {stage}")
    state = load_state(project)
    entry = state["stages"].setdefault(stage,{"attempts":0})
    if status == "running": entry["attempts"] = int(entry.get("attempts",0)) + 1
    entry.update({"status":status,"message":message,"outputs":outputs or [],"updated_at":utc_now()})
    save_state(project,state)
    return state
