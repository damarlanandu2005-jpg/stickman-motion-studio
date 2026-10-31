from pathlib import Path
from .models import STAGES
from .state import set_stage
def record_stage(project: Path,stage: str,status: str,message: str=""):
    if stage not in STAGES: raise ValueError(f"Unknown stage: {stage}")
    if status not in {"running","completed","failed","blocked","pending"}: raise ValueError("Invalid stage status")
    set_stage(project,stage,status,message)
