from __future__ import annotations
import json
from pathlib import Path
DIRECTORIES=["research","script","storyboard","artwork/references","artwork/approved","artwork/work","animation/approved","animation/work","audio","renders","reports",".studio"]
def init_project(project: Path,title: str):
    project=project.resolve()
    project.mkdir(parents=True,exist_ok=True)
    for item in DIRECTORIES: (project/item).mkdir(parents=True,exist_ok=True)
    manifest=project/"storyboard"/"story.json"
    if manifest.exists(): raise FileExistsError(f"Refusing to overwrite existing manifest: {manifest}")
    data={"project_id":project.name,"title":title,"language":"en","target":{"aspect_ratio":"9:16","fps":30},"beats":[{"id":"beat_001","narration":"Replace this placeholder with approved narration.","duration_seconds":5.0,"shot_ids":["shot_001"]}]}
    manifest.write_text(json.dumps(data,indent=2),encoding="utf-8")
    (project/"script"/"script.md").write_text(f"# {title}\n\n[Draft narration — replace before production.]\n",encoding="utf-8")
    (project/"research"/"sources.json").write_text(json.dumps({"sources":[],"claims":[]},indent=2),encoding="utf-8")
    (project/"storyboard"/"shots.json").write_text(json.dumps({"project_id":project.name,"shots":[]},indent=2),encoding="utf-8")
    from .state import load_state,save_state
    save_state(project,load_state(project))
    return project
